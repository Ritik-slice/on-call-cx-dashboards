# Ops Dashboard — DCA (current-account onboarding)

Internal CX/ops diagnostic tool for the **DCA** channel (the legacy/direct current-account merchant onboarding flow) — a sibling to the DSA+CC / CC-only on-call dashboard, adapted to DCA's schema and funnel. Type in a `uuid`, see where a merchant is stuck in onboarding and why, in plain language, so a support agent can resolve or route a ticket without escalating to engineering.

**EDI / merchant_lending is explicitly out of scope** — a teammate is covering that flow separately. Any application flagged `ONBOARDING_PLATFORM_SYNC` renders an explicit "this is EDI, not DCA" message rather than DCA-shaped data.

## Read first

1. `PRD_ops_dashboard_dca.md` — product spec: pre-build gates, problem/context (bucket table — **shares are all TBD, no DCA escalation corpus exists yet**), goals/non-goals, scope, identity & source model (snapshot vs event-log gap), the 6 dashboard cards, milestone-by-milestone probable cases, reset (unconfirmed for DCA), open questions, release phasing, owner routing map, data-contract appendix.
2. `design_spec_ops_dashboard_dca.md` — layout, visual system (reused verbatim from the DSA+CC tool — same purple theme, one shared internal design system), what changed retargeting to DCA, design gaps, open decisions.
3. `dashboard_concept_summary_dca.md` — shorter companion doc: problem, what's built, scope, key design decisions to validate (D1–D6), what it does NOT do, what needs validation.
4. `test_cases.md` — scenario list with dashboard test-user IDs.
5. `index.html` / `render.js` / `styles.css` — the working prototype. `render.js` and `styles.css` are the single source of truth shared by `index.html` and the four dev-reference pages below — no drift.
6. `alerts-states.html` · `checks-states.html` · `event-delivery-states.html` · `journey-states.html` — dev-reference pages, each rendering every state/edge-case of one card via the shared renderers.

## The most important thing to know before reading further

Unlike the DSA+CC tool (built from a real 2,469-thread escalation corpus and a Slack-verified API contract), **this is a concept adaptation**: the schema/funnel facts (tables, columns, flags, `product_flow` values, the empty-hash GST/Udyam gotcha, etc.) are carried over accurately from prior verified analysis sessions, but **no DCA escalation corpus has been analysed and no data contract has been Slack-verified**. Every volume/share figure is marked TBD; every inferred owner/team name is marked "(assumed — confirm)"; every unconfirmed architectural gap (event-log source, reset behaviour, join correctness) is tracked as an open question in PRD §13. Read that section before treating anything here as final.
