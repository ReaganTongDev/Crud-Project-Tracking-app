import type { FC } from 'hono/jsx'

export const Layout: FC<{ title: string; children: any; userEmail?: string }> = (props) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{props.title} — Expense Tracker</title>
        <style>{`
          :root {
            --bg: #0b0f19;
            --surface: #151d2e;
            --surface-subtle: #1e293b;
            --border: #2e3c54;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent: #38bdf8;
            --accent-hover: #0284c7;
            --danger: #ef4444;
            --danger-hover: #dc2626;
            --ai-glow: rgba(168, 85, 247, 0.15);
            --ai-border: rgba(192, 132, 252, 0.35);
            --ai-text: #d8b4fe;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg);
            color: var(--text-primary);
            margin: 0;
            padding: 1.5rem;
            line-height: 1.5;
          }
          .container { max-width: 960px; margin: 0 auto; }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 1rem;
          }
          .card {
            background: var(--surface);
            border-radius: 10px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            border: 1px solid var(--border);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
          }
          .form-grid {
            display: grid;
            grid-template-columns: 1.2fr 2fr 1.3fr 1fr auto;
            gap: 0.75rem;
            align-items: end;
          }
          .filter-bar {
            display: flex;
            gap: 0.75rem;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 1rem;
            padding: 0.75rem 1rem;
            background: var(--surface-subtle);
            border-radius: 8px;
            border: 1px solid var(--border);
          }
          input, select, button {
            padding: 0.65rem 0.8rem;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: var(--bg);
            color: var(--text-primary);
            font-size: 0.9rem;
            transition: border-color 0.2s, background-color 0.2s;
          }
          input:focus, select:focus {
            outline: none;
            border-color: var(--accent);
          }
          button {
            cursor: pointer;
            background: var(--accent);
            border: none;
            font-weight: 600;
            color: #0b0f19;
          }
          button:hover { background: var(--accent-hover); }
          button.btn-danger { background: var(--danger); color: #fff; }
          button.btn-danger:hover { background: var(--danger-hover); }
          button.btn-secondary { background: var(--surface-subtle); color: var(--text-primary); border: 1px solid var(--border); }
          button.btn-secondary:hover { background: var(--border); }

          /* Modern AI Pill Button */
          .btn-ai-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: #231d38;
            color: #c084fc;
            border: 1px solid #6b21a8;
            padding: 0.2rem 0.6rem;
            border-radius: 9999px;
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.02em;
            cursor: pointer;
            box-shadow: none; /* Completely removed glow */
            transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
          }

          .btn-ai-pill:hover:not(:disabled) {
            background: #3b1d6e; /* Noticeably brighter purple base */
            border-color: #a855f7; /* High-contrast bright border */
            color: #faf5ff; /* Pure luminous bright text */
            box-shadow: none; /* Keep flat without blur */
          }

          .btn-ai-pill:active:not(:disabled) {
            background: #4c1d95;
            border-color: #c084fc;
          }

          .btn-ai-pill:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          /* Floating AI Chip Popup */
          .ai-bubble {
            display: none;
            margin-top: 0.75rem;
            padding: 0.55rem 0.85rem;
            background: linear-gradient(135deg, #1e1b38 100%);
            border: 1px solid var(--ai-border);
            border-radius: 8px;
            font-size: 0.82rem;
            align-items: center;
            justify-content: space-between;
            animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .ai-tag-chip {
            background: linear-gradient(135deg,#0284c7 100%);
            color: #fff;
            padding: 0.22rem 0.65rem;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.78rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: opacity 0.15s ease, transform 0.15s ease;
          }
          .ai-tag-chip:hover {
            opacity: 1;
            filter: brightness(1.15);
          }

          .spin {
            animation: rotate 1s linear infinite;
          }
          @keyframes rotate {
            100% { transform: rotate(360deg); }
          }

          .badge {
            display: inline-block;
            padding: 0.2rem 0.55rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            background: rgba(56, 189, 248, 0.1);
            color: var(--accent);
            border: 1px solid rgba(56, 189, 248, 0.2);
            font-weight: 500;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { padding: 0.85rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
          th { color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
          .empty-state { text-align: center; padding: 3rem 1rem; color: var(--text-secondary); }
          .amount { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 600; text-align: right; }
          .actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
          kbd {
            background: var(--surface-subtle);
            border: 1px solid var(--border);
            padding: 0.1rem 0.35rem;
            border-radius: 4px;
            font-size: 0.75rem;
            color: var(--text-secondary);
          }
          @media (max-width: 768px) {
            .form-grid { grid-template-columns: 1fr; }
            .header { flex-direction: column; align-items: flex-start; gap: 1rem; }
          }
        `}</style>
      </head>
      <body>
        <div class="container">
          <header class="header">
            <div>
              <h1 style="margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                Expense Tracker
              </h1>
              <span style="font-size: 0.8rem; color: var(--text-secondary);">Minimalist D1 + Workers AI Stack</span>
            </div>
            {props.userEmail && (
              <div style="display: flex; gap: 1rem; align-items: center;">
                <span style="color: var(--text-secondary); font-size: 0.9rem;">{props.userEmail}</span>
                <form action="/auth/logout" method="post" style="margin: 0;">
                  <button type="submit" class="btn-secondary" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">Logout</button>
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
    <div style="max-width: 420px; margin: 3rem auto;" class="card">
      <h2 style="margin-top: 0; font-size: 1.3rem;">{isRegister ? 'Create an Account' : 'Sign In'}</h2>
      {error && <div style="color: var(--danger); margin-bottom: 1rem; font-size: 0.85rem;">{error}</div>}
      <form method="post" action={isRegister ? '/auth/register' : '/auth/login'} style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <label style="display: block; font-size: 0.85rem; margin-bottom: 0.3rem; color: var(--text-secondary);">Email</label>
          <input type="email" name="email" required autofocus style="width: 100%;" />
        </div>
        <div>
          <label style="display: block; font-size: 0.85rem; margin-bottom: 0.3rem; color: var(--text-secondary);">Password (min 8 chars)</label>
          <input type="password" name="password" minlength={8} required style="width: 100%;" />
        </div>
        <button type="submit" style="margin-top: 0.5rem;">{isRegister ? 'Sign Up' : 'Log In'}</button>
      </form>
      <p style="margin-top: 1.5rem; font-size: 0.85rem; color: var(--text-secondary); text-align: center;">
        {isRegister ? (
          <>Already have an account? <a href="/login" style="color: var(--accent);">Sign in</a></>
        ) : (
          <>Need an account? <a href="/register" style="color: var(--accent);">Sign up</a></>
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
  analytics?: {
    totalSpent: number
    totalCount: number
    spendByTag: { tag: string; total_amount: number }[]
    spendByDay: { spent_at: string; total_amount: number }[]
  }
}> = ({ expenses, availableTags, currentFilters, userEmail, analytics }) => {
  const today = new Date().toISOString().split('T')[0]
  const maxDaySpend = Math.max(...(analytics?.spendByDay?.map((d) => d.total_amount) ?? [1]), 1)
  const totalTagSpend = analytics?.totalSpent || 1

  return (
    <Layout title="Dashboard" userEmail={userEmail}>
      {/* Analytics Banner */}
      {analytics && (
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="margin: 0; padding: 1.25rem;">
            <div style="color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase;">Total Spending</div>
            <div style="font-size: 1.75rem; font-weight: 700; color: var(--accent); font-family: monospace; margin-top: 0.25rem;">
              ${(analytics.totalSpent / 100).toFixed(2)}
            </div>
          </div>
          <div class="card" style="margin: 0; padding: 1.25rem;">
            <div style="color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase;">Total Transactions</div>
            <div style="font-size: 1.75rem; font-weight: 700; font-family: monospace; margin-top: 0.25rem;">
              {analytics.totalCount}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Trend & Tag Breakdown */}
      {analytics && analytics.spendByDay && analytics.spendByDay.length > 0 && (
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="margin: 0;">
            <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase;">Trend (Last 7 Active Days)</h4>
            <div style="height: 140px; display: flex; align-items: flex-end; gap: 8px; padding-top: 10px;">
              {analytics.spendByDay.map((d) => {
                const heightPercent = Math.max(8, Math.round((d.total_amount / maxDaySpend) * 100))
                return (
                  <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end;">
                    <span style="font-size: 0.65rem; color: var(--text-secondary); font-family: monospace; margin-bottom: 4px;">
                      ${(d.total_amount / 100).toFixed(0)}
                    </span>
                    <div
                      style={`width: 100%; background: var(--accent); border-radius: 4px 4px 0 0; height: ${heightPercent}%; transition: height 0.3s;`}
                      title={`${d.spent_at}: $${(d.total_amount / 100).toFixed(2)}`}
                    ></div>
                    <span style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 4px; white-space: nowrap;">
                      {d.spent_at.slice(5)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div class="card" style="margin: 0;">
            <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase;">Top Category Distribution</h4>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              {analytics.spendByTag.slice(0, 4).map((t) => {
                const pct = Math.round((t.total_amount / totalTagSpend) * 100)
                return (
                  <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                      <span>{t.tag}</span>
                      <span style="color: var(--text-secondary); font-family: monospace;">${(t.total_amount / 100).toFixed(2)} ({pct}%)</span>
                    </div>
                    <div style="background: var(--bg); height: 6px; border-radius: 3px; overflow: hidden;">
                      <div style={`background: var(--accent); height: 100%; width: ${pct}%;`}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Record Expense Form */}
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.1rem;">Record Expense</h3>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Press <kbd>N</kbd> to quick-add</span>
        </div>

        <form method="post" action="/expenses" class="form-grid" id="expense-form">
          <div>
            <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Date</label>
            <input
              type="date"
              name="spent_at"
              defaultValue={today}
              required
              onclick="this.showPicker()"
              style="width: 100%; color-scheme: dark; cursor: pointer;"
            />
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Remark / Note</label>
            <input id="remark-input" type="text" name="remark" placeholder="e.g. Flight ticket to Tokyo" required style="width: 100%;" />
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <label style="font-size: 0.8rem; color: var(--text-secondary);">Tag</label>

              {/* ✨ Upgraded AI Suggestion Pill Button */}
              <button type="button" id="suggest-btn" class="btn-ai-pill" title="Auto-classify using Workers AI">
                <svg id="ai-icon-sparkle" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"/>
                </svg>
                <svg id="ai-icon-spinner" class="spin" style="display: none;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
                </svg>
                <span id="suggest-btn-text">AI Suggest</span>
              </button>
            </div>

            <input id="tag-input" type="text" name="tag" placeholder="e.g. Travel" list="tag-suggestions" style="width: 100%;" />
            <datalist id="tag-suggestions">
              {availableTags.map((t) => <option value={t} />)}
            </datalist>
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Amount ($)</label>
            <input type="number" step="0.01" min="0.01" name="amount_display" placeholder="0.00" required style="width: 100%;" />
          </div>
          <button type="submit">Add</button>
        </form>

        {/* Floating AI Suggestion Result Box */}
        <div id="ai-suggestion-box" class="ai-bubble">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: var(--ai-text); font-size: 0.78rem;">✨ Suggested Tag:</span>
            <span id="ai-suggested-tag" class="ai-tag-chip" title="Click to apply">
              <span id="ai-chip-label">Tag</span>
              <span style="font-size: 0.7rem; opacity: 0.8;">↵ Apply</span>
            </span>
          </div>
          <button
            type="button"
            id="dismiss-ai-btn"
            style="background: none; border: none; color: var(--text-secondary); font-size: 0.9rem; padding: 0.1rem 0.3rem; cursor: pointer;"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Transaction History Card */}
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.1rem;">Transaction History</h3>
          {expenses.length > 0 && (
            <form
              action="/expenses/delete-all"
              method="post"
              onsubmit="return confirm('⚠️ Are you sure you want to delete ALL your expenses? This action cannot be undone!');"
              style="margin: 0;"
            >
              <button
                type="submit"
                class="btn-danger"
                style="padding: 0.35rem 0.75rem; font-size: 0.8rem;"
              >
                Delete All
              </button>
            </form>
          )}
        </div>

        <form method="get" action="/" class="filter-bar">
          <label style="font-size: 0.85rem; color: var(--text-secondary);">Filters:</label>
          <select name="tag">
            <option value="">All Categories</option>
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
          <span style="color: var(--text-secondary);">to</span>
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
            <a href="/" style="font-size: 0.85rem; color: var(--accent); text-decoration: none; margin-left: auto;">Clear Filters</a>
          )}
        </form>

        {expenses.length === 0 ? (
          <div class="empty-state">
            <p>No transactions found.</p>
            <span style="font-size: 0.85rem;">Try clearing your filters or record an expense above.</span>
          </div>
        ) : (
          <div style="overflow-x: auto;">
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
                    <td style="white-space: nowrap;">{e.spent_at}</td>
                    <td>{e.remark}</td>
                    <td>{e.tag ? <span class="badge">{e.tag}</span> : <span style="color: var(--text-secondary);">—</span>}</td>
                    <td class="amount">${(e.amount / 100).toFixed(2)}</td>
                    <td class="actions">
                      <form
                        action={`/expenses/${e.id}/delete`}
                        method="post"
                        onsubmit="return confirm('Are you sure you want to delete this transaction?');"
                        style="margin: 0;"
                      >
                        <button type="submit" class="btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Keyboard Shortcut: press 'n' to jump to remark
            window.addEventListener('keydown', (e) => {
              if (e.key.toLowerCase() === 'n' && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                const input = document.getElementById('remark-input');
                if (input) input.focus();
              }
            });

            // Enhanced AI Suggestion Logic
            const suggestBtn = document.getElementById('suggest-btn');
            const suggestBtnText = document.getElementById('suggest-btn-text');
            const sparkleIcon = document.getElementById('ai-icon-sparkle');
            const spinnerIcon = document.getElementById('ai-icon-spinner');
            const remarkInput = document.getElementById('remark-input');
            const tagInput = document.getElementById('tag-input');
            const box = document.getElementById('ai-suggestion-box');
            const chip = document.getElementById('ai-suggested-tag');
            const chipLabel = document.getElementById('ai-chip-label');
            const dismissBtn = document.getElementById('dismiss-ai-btn');

            async function requestAiTag() {
              const remark = remarkInput.value.trim();
              if (!remark) {
                remarkInput.focus();
                return;
              }

              suggestBtn.disabled = true;
              sparkleIcon.style.display = 'none';
              spinnerIcon.style.display = 'inline-block';
              suggestBtnText.innerText = 'Tagging...';

              try {
                const res = await fetch('/api/ai/suggest-tag', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ remark })
                });
                const data = await res.json();
                if (data.success && data.data.tag) {
                  chipLabel.innerText = data.data.tag;
                  box.style.display = 'flex';
                }
              } catch (e) {
                console.error(e);
              } finally {
                suggestBtn.disabled = false;
                sparkleIcon.style.display = 'inline-block';
                spinnerIcon.style.display = 'none';
                suggestBtnText.innerText = 'AI Suggest';
              }
            }

            if (suggestBtn) {
              suggestBtn.addEventListener('click', requestAiTag);
            }

            if (chip) {
              chip.addEventListener('click', () => {
                tagInput.value = chipLabel.innerText;
                box.style.display = 'none';
              });
            }

            if (dismissBtn) {
              dismissBtn.addEventListener('click', () => {
                box.style.display = 'none';
              });
            }
          `,
        }}
      />
    </Layout>
  )
}