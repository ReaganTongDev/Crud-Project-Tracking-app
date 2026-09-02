import type { FC } from 'hono/jsx'

export const Layout: FC<{ title: string; children: any; userEmail?: string }> = (props) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{props.title}</title>
        <style>{`
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
          .container { max-width: 900px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid #334155; padding-bottom: 1rem; }
          .card { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; border: 1px solid #334155; }
          .form-grid { display: grid; grid-template-columns: 1.2fr 2fr 1fr 1fr auto; gap: 0.75rem; align-items: end; }
          .filter-bar { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; padding: 0.75rem; background: #0f172a; border-radius: 6px; }
          input, select, button { padding: 0.6rem 0.75rem; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 0.95rem; }
          select { cursor: pointer; }
          button { cursor: pointer; background: #2563eb; border: none; font-weight: 600; }
          button:hover { background: #1d4ed8; }
          button.btn-danger { background: #dc2626; }
          button.btn-danger:hover { background: #b91c1c; }
          button.btn-secondary { background: #475569; }
          .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; background: #334155; color: #38bdf8; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }
          th { color: #94a3b8; font-weight: 500; }
          .empty-state { text-align: center; padding: 3rem 1rem; color: #94a3b8; }
          .amount { font-family: monospace; font-weight: 600; text-align: right; }
          .actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
        `}</style>
      </head>
      <body>
        <div class="container">
          <header class="header">
            <h1 style="margin: 0; font-size: 1.5rem;">Expense Tracker</h1>
            {props.userEmail && (
              <div style="display: flex; gap: 1rem; align-items: center;">
                <span style="color: #94a3b8; font-size: 0.9rem;">{props.userEmail}</span>
                <form action="/auth/logout" method="post" style="margin: 0;">
                  <button type="submit" class="btn-secondary" style="font-size: 0.8rem; padding: 0.3rem 0.6rem;">Logout</button>
                </form>
              </div>
            )}
          </header>
          {props.children}
        </div>
      </body>
    </html>
  )
}

export const AuthView: FC<{ isRegister?: boolean; error?: string }> = ({ isRegister, error }) => (
  <Layout title={isRegister ? 'Register' : 'Login'}>
    <div style="max-width: 400px; margin: 3rem auto;" class="card">
      <h2 style="margin-top: 0;">{isRegister ? 'Create Account' : 'Sign In'}</h2>
      {error && <div style="color: #ef4444; margin-bottom: 1rem; font-size: 0.9rem;">{error}</div>}
      <form method="post" action={isRegister ? '/auth/register' : '/auth/login'} style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <label style="display: block; font-size: 0.85rem; margin-bottom: 0.3rem; color: #94a3b8;">Email</label>
          <input type="email" name="email" required style="width: 100%; box-sizing: border-box;" />
        </div>
        <div>
          <label style="display: block; font-size: 0.85rem; margin-bottom: 0.3rem; color: #94a3b8;">Password</label>
          <input type="password" name="password" minLength={8} required style="width: 100%; box-sizing: border-box;" />
        </div>
        <button type="submit" style="margin-top: 0.5rem;">{isRegister ? 'Sign Up' : 'Log In'}</button>
      </form>
      <p style="margin-top: 1.5rem; font-size: 0.85rem; color: #94a3b8; text-align: center;">
        {isRegister ? (
          <>Already have an account? <a href="/login" style="color: #38bdf8;">Sign in</a></>
        ) : (
          <>Need an account? <a href="/register" style="color: #38bdf8;">Sign up</a></>
        )}
      </p>
    </div>
  </Layout>
)

export const ExpensesView: FC<{
  expenses: any[]
  availableTags: string[]
  currentFilters: { tag?: string; from?: string; to?: string }
  userEmail: string
}> = ({ expenses, availableTags, currentFilters, userEmail }) => {
  const today = new Date().toISOString().split('T')[0]

  return (
    <Layout title="Dashboard" userEmail={userEmail}>
      <div class="card">
        <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem;">Add New Expense</h3>
        <form method="post" action="/expenses" class="form-grid" id="expense-form">
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">Date</label>
            <input
              type="date"
              name="spent_at"
              defaultValue={today}
              required
              onclick="this.showPicker()"
              style="width: 100%; box-sizing: border-box; color-scheme: dark; cursor: pointer;"
            />
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">Remark / Note</label>
            <input
              id="remark-input"
              type="text"
              name="remark"
              placeholder="e.g. Starbucks Latte"
              required
              style="width: 100%; box-sizing: border-box;"
            />
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <label style="font-size: 0.8rem; color: #94a3b8;">Tag</label>
              <button
                type="button"
                id="suggest-btn"
                style="background: none; border: none; color: #38bdf8; font-size: 0.75rem; padding: 0; cursor: pointer; text-decoration: underline;"
              >
                ✨ Suggest
              </button>
            </div>
            <input
              id="tag-input"
              type="text"
              name="tag"
              placeholder="e.g. Coffee"
              list="tag-suggestions"
              style="width: 100%; box-sizing: border-box;"
            />
            <datalist id="tag-suggestions">
              {availableTags.map((t) => <option value={t} />)}
            </datalist>
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.25rem;">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              name="amount_display"
              placeholder="0.00"
              required
              style="width: 100%; box-sizing: border-box;"
            />
          </div>
          <button type="submit">Add</button>
        </form>

        {/* AI Suggestion Box */}
        <div
          id="ai-suggestion-box"
          style="display: none; margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: #0f172a; border-radius: 6px; font-size: 0.85rem; align-items: center; gap: 0.5rem;"
        >
          <span style="color: #94a3b8;">Suggested:</span>
          <span
            id="ai-suggested-tag"
            style="background: #334155; color: #38bdf8; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 600; cursor: pointer;"
            title="Click to apply"
          ></span>
          <span style="color: #64748b; font-size: 0.75rem;">(click chip to apply)</span>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem;">Transactions</h3>

        <form method="get" action="/" class="filter-bar">
          <label style="font-size: 0.85rem; color: #94a3b8;">Filter:</label>
          <select name="tag">
            <option value="">All Tags</option>
            {availableTags.map((t) => (
              <option value={t} selected={currentFilters.tag === t}>{t}</option>
            ))}
          </select>
          <input
            type="date"
            name="from"
            value={currentFilters.from || ''}
            title="From date"
            onclick="this.showPicker()"
            style="color-scheme: dark; cursor: pointer;"
          />
          <span style="color: #64748b;">to</span>
          <input
            type="date"
            name="to"
            value={currentFilters.to || ''}
            title="To date"
            onclick="this.showPicker()"
            style="color-scheme: dark; cursor: pointer;"
          />
          <button type="submit" class="btn-secondary" style="font-size: 0.85rem;">Apply</button>
          {(currentFilters.tag || currentFilters.from || currentFilters.to) && (
            <a href="/" style="font-size: 0.85rem; color: #38bdf8; text-decoration: none; margin-left: auto;">Reset</a>
          )}
        </form>

        {expenses.length === 0 ? (
          <div class="empty-state">
            <p>No expenses match your criteria.</p>
            <span style="font-size: 0.85rem;">Adjust filters or add a new transaction above.</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Remark</th>
                <th>Tag</th>
                <th style="text-align: right;">Amount</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr>
                  <td>{e.spent_at}</td>
                  <td>{e.remark}</td>
                  <td>{e.tag ? <span class="badge">{e.tag}</span> : <span style="color: #64748b;">—</span>}</td>
                  <td class="amount">${(e.amount / 100).toFixed(2)}</td>
                  <td class="actions">
                    <form
                      action={`/expenses/${e.id}/delete`}
                      method="post"
                      onsubmit="return confirm('Are you sure you want to delete this expense?');"
                      style="margin: 0;"
                    >
                      <button type="submit" class="btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            const suggestBtn = document.getElementById('suggest-btn');
            const remarkInput = document.getElementById('remark-input');
            const tagInput = document.getElementById('tag-input');
            const box = document.getElementById('ai-suggestion-box');
            const chip = document.getElementById('ai-suggested-tag');

            if (suggestBtn) {
              suggestBtn.addEventListener('click', async () => {
                const remark = remarkInput.value.trim();
                if (!remark) {
                  alert('Please enter a remark first');
                  return;
                }

                suggestBtn.innerText = 'Thinking...';
                suggestBtn.disabled = true;

                try {
                  const res = await fetch('/api/ai/suggest-tag', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ remark })
                  });
                  const data = await res.json();
                  if (data.success && data.data.tag) {
                    chip.innerText = data.data.tag;
                    box.style.display = 'flex';
                  }
                } catch (e) {
                  console.error(e);
                } finally {
                  suggestBtn.innerText = '✨ Suggest';
                  suggestBtn.disabled = false;
                }
              });
            }

            if (chip) {
              chip.addEventListener('click', () => {
                tagInput.value = chip.innerText;
                box.style.display = 'none';
              });
            }
          `,
        }}
      />
    </Layout>
  )
}