# NOTES.md — AI Correction Ledger & Build Log

This file tracks every instance where the AI generated incorrect code, violated architecture rules, hallucinated dependencies, or needed manual correction during code review / diff review.

---

## 🛑 Project Non-Negotiables & Rules

1. **Integer Cents Only**: Never use floats for currency. `10.50` -> `1050`.
2. **User Context via Token**: `userId` is always extracted from the verified JWT / session context, never accepted from request query/body.
3. **Consistent Error Shape**: All API errors adhere to `{ "success": false, "error": { "code": string, "message": string, "details"?: any } }`.
4. **Tooling Boundary**: Cloudflare Workers, Hono (`hono/jsx`), Cloudflare D1, `wrangler`, `zod` + `@hono/zod-validator`, `hono/jwt` + `hono/cookie`, WebCrypto, Workers AI (Llama 3.1 8B). Nothing outside this list without explicit sign-off.
5. **Secrets Hygiene**: Never commit `.dev.vars`, JWT secrets, or production credentials to git.
6. **Deploy-at-Every-Stage Gate**: Walk through git diff with the AI window closed. If a line cannot be defended, it does not ship.

---

## 📝 Correction Log

*Format: `[YYYY-MM-DD] [Stage X] <What the AI proposed> -> <Why it was wrong / What was corrected>`*

- [2026-09-02] [Stage 1] Initialized project repository and verification baseline.
- [2026-09-02] [Stage 2] AI provided TOML configuration syntax (`[[d1_databases]]`) instead of checking project config type -> Corrected to JSONC array syntax (`"d1_databases": [...]`) in `wrangler.jsonc` and fixed missing trailing comma.
- [2026-09-02] [Stage 2] `schema.sql` file not created in project root or failed path resolution on Windows -> Created `schema.sql` at root and used direct file flag `--file=schema.sql`.
- [2026-09-02] [Stage 3] AI provided Unix Bash multiline curl commands (`\`) -> Incompatible with Windows PowerShell default alias (`Invoke-WebRequest`); corrected to `curl.exe` with escaped JSON quotes.
- [2026-09-02] [Stage 4] Added `hono/jsx` server-rendered UI while ensuring integer cent conversion (`Math.round(amount * 100)`) on web form POSTs.
- [2026-09-02] [Stage 5] Added `tag` column to `expenses` table, dynamic SQL parameterization for tag and date bounds, and SSR filter toolbar.


---

## 📋 Stage Progress Checklist

- [x] **Stage 1: Deploy empty** — Live URL active before any feature code.
- [x] **Stage 2: Accounts + login** — D1 user schema, WebCrypto PBKDF2 hashing, JWT via cookie, auth middleware.
- [x] **Stage 3: Expense CRUD** — D1 expenses schema, integer cents validation, unified JSON error shape, curl verified.
- [x] **Stage 4: Usable UI** — `hono/jsx` SSR pages, expense list, add/edit modals/forms, delete confirmation, empty state.
- [x] **Stage 5: Tags + filters** — Many-to-many / tag column, date range & tag filtering in D1 SQL.
- [ ] **Stage 6: AI tag suggestion** — Workers AI binding (Llama 3.1 8B), suggestion-only UI flow (never auto-applies).
- [ ] **Stage 7: Aggregates + charts** — SQL aggregate queries (spend per day, per tag, top expenses), SVG chart rendering.
- [ ] **Stage 8: Polish** — Responsive UX pass, keyboard shortcuts, final performance & security audit.
- [ ] **Stretch: MCP Server** — Cloudflare `agents` package integration for spending queries.


