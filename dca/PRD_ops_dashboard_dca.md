# PRD — CX / Ops Onboarding Dashboard (DCA)

| | |
|---|---|
| **Product** | Onboarding Status Lookup Dashboard — DCA (internal, read-only) |
| **Owner** | Product (TBD — assign before build-commit) |
| **Status** | Draft — concept adaptation, not yet reviewed against a DCA escalation corpus |
| **Version** | 0.1 (adapted from the DSA+CC / CC-only tool, v1.2) |
| **Basis** | Schema/funnel knowledge from prior verified analysis sessions (`a2_onboarding_gold`, `kycdb_gold`, `user_state_repository_db_gold`, `merchantdb_gold`, `uid_db_gold`). **No DCA escalation-thread corpus has been analysed yet** — every share/volume figure in this document is a placeholder, not a measurement. See §13. |
| **Scope** | **DCA** — the legacy/direct current-account (CA) merchant onboarding flow. Identified by `user_state_repository_db_gold.user_states.updated_by = 'onboarding-svc'` and `a2_onboarding_gold.slice_x_application_base.flags NOT LIKE '%ONBOARDING_PLATFORM_SYNC%'`. **EDI / merchant_lending (the newer platform-synced flow, `updated_by = 'onboarding_v2'`) is explicitly out of scope** — a teammate is covering it as a follow-up. |

> **Companion product** — this is the DCA-channel sibling of `PRD_ops_dashboard.md` (the DSA+CC / CC-only tool). Same job (CX agent types in an identifier, sees where a merchant is stuck in onboarding and why, in plain language, without escalating to engineering), same visual/IA family, different domain underneath. Sections below are structured to match that PRD 1:1 so the two stay comparable; §0 and §13 carry the honesty load — DCA has real, verified schema facts but **no measured escalation-volume data yet**.

---

## 0. Pre-Build Gates

Resolve before build-commit (don't change the product; make it buildable):

- **0.0 No escalation corpus [Product]** — the DSA+CC tool's PRD was built from 2,469 labelled CX escalation threads. **DCA has no equivalent corpus analysed.** Every bucket share, priority ranking, and "how much is solvable" number in §1 is a **placeholder** pending a DCA-specific thread pull (see Q-DCA-1). Do not brief stakeholders with these numbers as if measured.
- **0.1 Source & freshness [Eng]** — the primary source, `a2_onboarding_gold.slice_x_application_base`, is a **current-state snapshot** (one row per `uuid`, `flags` as a flattened comma-separated string), not an event log. This is architecturally different from the DSA+CC tool's `application_flow_histories` event stream. It means: "where is the user now" is derivable (last flag), but **"when did each milestone happen" is not directly available from this source** the way it is for DSA+CC. See Q-DCA-2 — this blocks any per-milestone-timestamp UI claim until resolved. Every field shown must carry "as of &lt;fetch time&gt;" + manual refresh, same discipline as the DSA+CC tool.
- **0.2 Metrics & validation [Product]** — no baseline exists for any success metric below; all are TBD pending pilot instrumentation, exactly as flagged in §2.2.
- **0.3 UI logic rules [Product+Eng]** — status precedence and progress denominator (§7.6) are proposed by analogy to the DSA+CC tool's rules; confirm against actual DCA state-machine behaviour before build (the flags-as-snapshot model may not support the same precedence ladder cleanly — see §7.6 note).
- **0.4 GST/Udyam policy [Product]** — Udyam is currently mandatory to pass Business Details; GST is not gating today. There is an open proposal to relax to "GST OR Udyam." **Do not build against the proposed rule — build against the current mandatory-Udyam rule**, and flag the proposal in Open Questions (§13) so it isn't silently shipped as if decided.

---

## 1. Problem & Context

Stuck-onboarding tickets for current-account (DCA) merchants have the same structural problem as the DSA+CC tool was built to solve: CX has no single place to see where a merchant is stuck and why, and ends up escalating to engineering just to reconstruct state that already exists somewhere in the data — it's just scattered across `a2_onboarding_gold`, `kycdb_gold`, `merchantdb_gold`, and Slack.

### 1.1 The on-call load

**No sample corpus exists yet for DCA.** The DSA+CC PRD was scoped from a 2,469-thread, 3-week Slack corpus. Building the equivalent DCA picture requires pulling and labelling a comparable DCA-specific escalation sample (Q-DCA-1) before any bucket can be sized with confidence. Everything below is a **qualitative** placeholder structure — the bucket *names* are derived from real DCA rejection/verification taxonomy (§Appendix D), the bucket *shares* are not.

### 1.2 All escalation buckets (qualitative — shares TBD)

| # | Bucket | Share | Solvability (proposed) |
|---|---|---|---|
| D1 | **Account not created** (KYC approved, `CURRENT_ACCOUNT_CREATED` property never set) | TBD — needs DCA escalation corpus | Diagnosable |
| D2 | **Fraud / blacklist block** (`USER_BLACKLISTED`) | TBD — needs DCA escalation corpus | Routable |
| D3 | **Dedupe conflicts** — PAN dedupe, existing-bank-user, cross-product (mini/savings/borrow) | TBD — needs DCA escalation corpus | Routable |
| D4 | **GST not verified** (non-gating today, but a recurring "why can't I move on" question) | TBD — needs DCA escalation corpus | Self-resolvable / Routable |
| D5 | **Udyam not verified** (mandatory gate — hard block at Business Details) | TBD — needs DCA escalation corpus | Routable |
| D6 | **VKYC rejected / pending** | TBD — needs DCA escalation corpus | Routable |
| D7 | **Audit review** (`MOVED_TO_AUDIT`, no visible age or outcome) | TBD — needs DCA escalation corpus | Routable |
| D8 | **Declined with no matching red flag** ("other" — investigate) | TBD — needs DCA escalation corpus | Diagnosable |
| D9 | **Reset / re-onboarding confusion** | TBD — needs DCA escalation corpus **and confirmation DCA resets work like DSA+CC's** (Q-DCA-4) | Self-resolvable (unconfirmed) |
| D10 | **Business-details data-quality** (empty-hash GST/Udyam misread as "missing," `merchant_info.gst_no` dead column confusion) | TBD — needs DCA escalation corpus | Self-resolvable |
| — | *Subtotal — in-scope DCA onboarding* | **TBD** | — |
| D11 | **EDI / merchant_lending** (`ONBOARDING_PLATFORM_SYNC` present) | TBD | Out of scope (teammate's follow-up) |
| D12 | **Other current-account servicing** (post-approval banking, non-onboarding) | TBD | Out of scope |

> **Nothing in this table is a measured percentage.** Treat it as a labelled skeleton to hang a real corpus pull against (Q-DCA-1), not as sizing evidence. This mirrors the DSA+CC PRD's own distinction between "(known)" and "(est.)" buckets — except here **nothing is (known) yet**.

### 1.3 How much is solvable

Cannot be estimated without §1.2's real shares. The DSA+CC tool used its measured "~53% addressable" headline; **no equivalent number exists for DCA** and none should be quoted until Q-DCA-1 is resolved.

---

## 2. Goals & Success Metrics

> **North star:** complete visibility into a DCA merchant's onboarding state — no blind spots. Not a routing engine, decisioning tool, or SOP. (Same principle as the DSA+CC tool, §2 there.)

### 2.1 Goals
1. **Complete visibility** — surface every piece of DCA onboarding state the source exposes (flags, redflags, VKYC, GST/Udyam, audit, account creation), nothing summarised away without a path to raw detail.
2. Diagnose a stuck DCA merchant's exact state + blocker in under a minute from a single lookup.
3. Surface what's invisible today: which flag last fired (current screen position), redflag/rejection reason bucket, GST vs Udyam verification state (and the empty-hash gotcha), VKYC rejection reason, audit-review presence, account-creation outcome.
4. One shared vocabulary for DCA onboarding state across CX, ops, fraud, UID, and the GST/Udyam verification owner.

### 2.2 Success metrics

**No baselines exist.** Every metric below needs a baseline captured in a pilot window, same discipline as §0.2/§2.2 of the DSA+CC PRD — the difference is DCA has *no* prior instrumentation to draw even a rough baseline from.

| Metric | Baseline | How measured | Target |
|---|---|---|---|
| Median time to diagnose a DCA onboarding ticket | TBD — capture pre-launch | Ticket handle-time (open → diagnosis logged) | Directional ↓ (no number until baseline exists) |
| % DCA onboarding tickets escalated to engineering | TBD | Escalation tags in ticketing tool | Directional ↓ |
| % tickets routed to the wrong team on first touch | TBD | Re-assignment / bounce count | Directional ↓ |
| % of in-scope DCA stuck cases explained without engineering | ~0% today (no tool) | Pilot audit | Directional ↑ |
| Agent confidence post-lookup | TBD | Post-lookup micro-survey in pilot | Directional ↑ |

### 2.3 Anti-metrics (watch)
- Agents reading a stale flags-snapshot as live truth (mitigated by "as of &lt;time&gt;" + refresh, same as DSA+CC).
- Agents assuming GST is mandatory when it isn't today (or assuming the proposed "GST OR Udyam" rule already shipped) — the tool must show the *current* rule, not the proposed one (§0.4).
- Agents attempting an action the tool implies but does not support — read-only by design.

### 2.4 Rollout & adoption
- Pilot with a small named group of L1/L2 agents on a defined DCA ticket cohort.
- Training: a walkthrough of the §7.0 CX story and the owner-routing map (Appendix), with explicit emphasis on the GST/Udyam mandatory-today caveat and the "this is an event-log gap, not a bug" framing for missing per-milestone timestamps.
- Adoption signal: dashboard opens per DCA onboarding ticket.

---

## 3. Non-Goals

| # | Non-goal | Rationale |
|---|---|---|
| NG1 | Any action that changes user/application state | Read-only by design, same as DSA+CC tool. |
| NG2 | Live/streaming updates | Fetched on lookup. |
| NG3 | Full historical audit trail | `slice_x_application_base` is a snapshot, not a log — a full audit trail is not even available from the primary source today (§5.3 architectural gap), let alone in scope for v1. |
| NG4 | The SOP / decision tree / next-actions | Dashboard shows state; SOP says what to do. |
| NG5 | Ticketing (Freshdesk) integration | Out of v1. |
| NG6 | **EDI / merchant_lending** (`ONBOARDING_PLATFORM_SYNC` apps) | Explicitly out of scope — separate teammate effort. An EDI app must render an explicit "this is EDI, not DCA" message, never DCA-shaped data (§5.4, §10). |
| NG7 | Alerting / notification | Lookup, not a push channel. |
| NG8 | Routing engine / SLA decisioning | We show timestamps/state; routing + SLA thresholds live in the SOP/ops process. |
| NG9 | **Deciding the GST/Udyam policy** | The tool reflects whatever the current rule is (Udyam mandatory, GST optional, as of this writing); it does not implement or anticipate the proposed relaxation (§0.4, §13). |

---

## 4. Users

| Persona | Need | Technical depth |
|---|---|---|
| **CX agent (L1)** | Answer "why is this merchant's CA stuck?" and resolve or route correctly. | Low — plain language + owner. |
| **On-call ops / senior CX (L2)** | Confirm systemic issues, judge escalation. | Medium. |
| **Engineering on-call** | Fast triage: known systemic issue vs one-off. | High. |
| **GST/Udyam verification owner** (assumed team — confirm with ops) | Understand which merchants are blocked on business-verification specifically. | Medium. |

---

## 5. Scope

### 5.1 In scope — one application type: DCA current-account onboarding

DCA (legacy/direct current-account merchant onboarding). Identified by:
- `user_state_repository_db_gold.user_states.updated_by = 'onboarding-svc'` (vs EDI's `onboarding_v2`), **and**
- `a2_onboarding_gold.slice_x_application_base.flags NOT LIKE '%ONBOARDING_PLATFORM_SYNC%'` (that flag marks platform-synced/EDI-equivalent apps).

### 5.2 Out of scope (current)

- **EDI / merchant_lending** (`updated_by = 'onboarding_v2'`, or `flags LIKE '%ONBOARDING_PLATFORM_SYNC%'`) — a separate, newer flow; a teammate is building its own on-call tool as a follow-up pass. **Forward-compatible note:** if/when a merchant's application shows `ONBOARDING_PLATFORM_SYNC`, this dashboard should say so plainly and point at "the EDI tool" rather than attempt to render DCA-shaped milestones over it — the two flows are not the same state machine and must not be visually conflated.
- Savings / mini / borrow onboarding (different products entirely; referenced here only as dedupe cross-product targets, §5.5).
- Current-account *servicing* after onboarding completes (core banking / statements / etc.) — out of scope, this tool is onboarding-only.

### 5.3 Identity & source model

Unlike the DSA+CC tool — one `onboarding-v2` call returning a rich per-milestone event log (`application_flow_histories`) — **DCA's primary source is a current-state snapshot table**, not an event log:

| | DSA+CC / CC-only (source PRD) | DCA (this PRD) |
|---|---|---|
| Primary source | `onboarding-v2` `application-details` API | `a2_onboarding_gold.slice_x_application_base` (SQL table, ~846k rows) |
| Shape | Per-milestone event log (`application_flow_histories`, timestamped actions) | **Current-state snapshot** — one row per `uuid`, `flags` = comma-separated string of milestone flags reached so far |
| "Where is the user now" | Derived from the *latest* flowHistory action | Derived from the **last flag** in `split(flags, ',')` |
| "When did each milestone happen" | Directly available (`created_at` per flowHistory row) | **Not directly available from this source.** The flags string records *that* a milestone was reached, not *when* each one was. This is the single biggest architectural gap versus the DSA+CC tool — see §0.1, Q-DCA-2. |
| Join key | `uuid` throughout | **`uuid`** (not `user_uuid` — a naming trap across DCA tables) |

**A merchant is one `uuid`.** For DCA specifically, the single row in `slice_x_application_base` for that `uuid` (filtered to DCA per §5.1) is the anchor record; everything else (redflags, VKYC, GST/Udyam, dedupe, account creation) is joined onto it by `uuid`.

**Forward-compatibility note (mirrors the source PRD's DSA-only/Borrow-migrating-to-v2 pattern):** if DCA is ever migrated onto a v2-style event-log platform, the per-milestone-timestamp gap in §0.1 disappears and this dashboard's timeline should switch to consuming that log directly — the milestone *names* and card layout would not need to change, only the timestamp derivation.

### 5.4 Scope handling requirements

- **If the application is EDI, not DCA** (`ONBOARDING_PLATFORM_SYNC` present, or `updated_by = 'onboarding_v2'`): show an explicit "this application is EDI, not DCA — see the EDI on-call tool" message. **Never** render DCA milestones over an EDI application — the flag taxonomy and funnel are different flows and a naive render would show misleading nonsense (e.g. a `flags` string with `ONBOARDING_PLATFORM_SYNC` mapped through the DCA milestone table would produce garbage).
- **If the source is unavailable:** show an explicit "data unavailable" state, never a blank/misleading screen.
- **If a lookup UUID matches a row with no DCA application at all** (e.g. only savings/mini/borrow): show an explicit "no DCA application" message.

### 5.5 Field & fingerprint mapping

| Dashboard signal | Source | Rule / fingerprint |
|---|---|---|
| Application state · flow · flags | `a2_onboarding_gold.slice_x_application_base` (`state`, `onboarding_flow`, `is_deleted`, `flags`, `to_visit_screen`, `business_details_id`, `business_verification_status`, `year`) | join key `uuid`; DCA filter `flags NOT LIKE '%ONBOARDING_PLATFORM_SYNC%'` |
| Current milestone / position | `flags` — **last** flag in `split(flags, ',')` | canonical map, §8.0 |
| Secondary / legacy position signal | `to_visit_screen` | secondary signal, §8.0 — document, don't treat as primary |
| **Account not created (P0)** | `user_state_repository_db_gold.user_states` where `property_value = 'CURRENT_ACCOUNT_CREATED'` is **absent** for a `uuid` whose `state = 'KYC_APPROVED'`-equivalent | fingerprint: KYC approved **and** no `CURRENT_ACCOUNT_CREATED` property row — the DCA analogue of the source PRD's `cif = null` fingerprint |
| Rejection / decline | `state = 'REJECTED'`, dated by `updated_at` | terminal negative |
| Rejection reason breakdown | `a2_onboarding_gold.slice_x_redflags` (join `uuid`, filter `isdeleted=false AND (validated=true OR blocker=true)`) | priority-ordered bucketing, §7.2.4 — **aggregate, don't double-count** when a `uuid` has multiple redflag rows |
| VKYC outcome | `kycdb_gold.vkyc_details` (`status='REJECTED'`, **`product_flow=15`** for DCA) | **DCA-specific `product_flow` value** — do not reuse EDI's `115` or savings' `49` |
| GST presence | `kycdb_gold.business_details.gst_number` **(never NULL — empty string is the "no GST" hash, not NULL/'')** — DCA GST is that non-empty hash **OR** a matching row in `kycdb_gold.bureau_id_gstin_advanced_details` | **Landmine:** must exclude the empty-hash value explicitly, `IS NOT NULL` alone is wrong. **DCA GST rows in `bureau_id_gstin_advanced_details` are mostly `product_flow=2`** — do not filter this table by the KYC/VKYC `product_flow=15` convention, that would drop most DCA GST rows. |
| Udyam presence | `kycdb_gold.business_details.udyam_aadhaar_number` — same empty-hash pattern as GST | Mandatory today to pass Business Details (§0.4). No confirmed-autofetch signal exists for DCA (see below) — captured via `UDYAM_AADHAAR_SUBMITTED` (manual only). |
| Business verification (rollup) | `slice_x_application_base.business_verification_status` | secondary/summary signal alongside the GST/Udyam detail fields |
| Dedupe / fraud reasons | `slice_x_redflags.reason` values: `USER_BLACKLISTED`, `EXISTING_BANK_USER`, `PAN_DEDUPE_EXISTS_WITH_DIFFERENT_UUID`, `*_EXISTS_WITH_DIFFERENT_UUID_IN_{MINI,SAVINGS,BORROW}_ONBOARDING`, `GST_NOT_VERIFIED`, `UDYAM_NOT_VERIFIED`, `VKYC_REJECTED`, `VKYC_PENDING`, `CONCURRENT_AUDIT_REVIEW_DECLINED` | priority-ordered bucketing (fraud > FIA > audit > VKYC-agent > redflag/dedupe > other), §7.2.4 |
| "Other" rejection (no matching redflag) | `REJECTED` count minus fraud minus VKYC minus audit buckets | apps rejected with **no** matching redflag row at all — itself worth an "investigate" alert (mirrors the source PRD's Milestone-9 "declined with no red flags" case) |
| Source-channel context | `uid_db_gold.customers` (`source_channel` SLICE/MERCHANT), join `customers.id = slice_x_application_base.uuid` | supporting identity context; join-correctness itself is an open question, §13 |
| Merchant mode | `merchantdb_gold.merchant_info` (`mode`: OFFLINE=CA holders / ONLINE=payment) | **`merchant_info.gst_no` is a dead/untrustworthy column — never use it for GST state.** |
| Core-banking / CA confirmation | `bsgcore_gold` / `bsgaccounting_gold` | supporting confirmation of account existence, alongside the `user_states` property signal above |
| Freshness "as of" | client fetch time | §12 |

**Confirmed real `flags` values** (safe to key logic on): `BUSINESS_DETAILS_SUBMITTED`, `VKYC_VERIFIED`, `MOVED_TO_AUDIT`, `ONBOARDING_PLATFORM_SYNC`, plus the full canonical set in §8.0. **Flags that do NOT exist and must never be invented as if real:** `GST_PROVIDED`, `UDYAM_SUBMITTED`, `CPV_DONE`. GST/Udyam/CPV status must always come from the dedicated tables above (`business_details`, `bureau_id_gstin_advanced_details`), never assumed from a flags-string flag that isn't real.

### 5.6 Fetch & selection strategy

Per lookup, the dashboard runs one lookup by `uuid` fanned out to the tables above **in parallel** — there is no single rich API call the way the DSA+CC tool has one `onboarding-v2` call; DCA's "one lookup" is a **parallel multi-table read**, not a single service call:

| Query (conceptually parallel) | Purpose |
|---|---|
| `a2_onboarding_gold.slice_x_application_base` by `uuid`, DCA-filtered | Anchor record: state, flags, `to_visit_screen`, business_details_id, business_verification_status |
| `a2_onboarding_gold.slice_x_redflags` by `uuid`, `isdeleted=false AND (validated=true OR blocker=true)` | Rejection/dedupe/fraud reason breakdown |
| `kycdb_gold.vkyc_details` by `uuid`, `product_flow=15` | VKYC outcome + rejection reason (granular reasons live here; **exclude `VKYC_REJECTED`/`VKYC_PENDING` from the redflags fraud bucket when using this table as the VKYC source, to avoid double-counting the same underlying signal from two tables**) |
| `kycdb_gold.business_details` by `uuid` (via `business_details_id`) | GST number / Udyam Aadhaar number (empty-hash aware) |
| `kycdb_gold.bureau_id_gstin_advanced_details` by `uuid`, **not** filtered by `product_flow` | Additional DCA GST signal (mostly `product_flow=2`) |
| `user_state_repository_db_gold.user_states` by `uuid`, `property_value='CURRENT_ACCOUNT_CREATED'` | Account-creation confirmation (the P0 fingerprint check) |
| `uid_db_gold.customers` by `customers.id = uuid` | `source_channel` context (join correctness — open question) |
| `merchantdb_gold.merchant_info` by `uuid` | `mode` (OFFLINE/ONLINE) — **never** its `gst_no` column |

**No confirmed event-log source exists for DCA today.** Unlike the DSA+CC tool's `selectionStrategy=all` pattern (which exists specifically to keep RESET applications visible), DCA has no equivalent documented mechanism, because there is no confirmed reset-representation model for DCA at all (§9, Q-DCA-4). This fetch list should be treated as a **first-pass minimum viable set** pending Q-DCA-2/Q-DCA-4/Q-DCA-8 resolution, not a final locked contract the way §5.6 was "locked" in the DSA+CC PRD.

---

## 6. Product Principles

Identical to the DSA+CC tool (same product family, same job):

1. **One lookup, one screen.**
2. **Plain language over system codes.**
3. **Always show the owner.**
4. **Milestone-based**, with the honest caveat that DCA milestones carry a *position*, not always a *timestamp* (§0.1).
5. **Read-only and honest.**
6. **No cropping.**

---

## 7. The Dashboard Cards

### 7.0 Layout & reading order

Same funnel as the DSA+CC tool: **headline → triage → likely cause → silent-failure → full narrative.**

| Order | Card | Answers | Level |
|---|---|---|---|
| ① Glance | **7.1 User** | Who is this merchant, headline status? | Per-application |
| ② Triage | **7.2 Alerts** | What's actively wrong, ranked? | Per-application |
| ③ Checks | **7.3 Checks** | Redflag/fraud · GST · Udyam · VKYC · Audit review? | Per-application |
| ④ Events | **7.4 Event delivery** | Did the key handoffs land — with the caveat that "received" here means "flag present in the current snapshot," not "we saw a discrete timestamped event" (§0.1) | Per-application |
| ⑤ Narrative | **7.5 Onboarding journey** | Which milestone (last flag), what's known about it, where it broke? | Per-application |

DCA has no multi-application-per-user model the way DSA+CC does (one merchant `uuid` → typically one DCA application) — so the **application switcher is not expected to be a primary UI element** for DCA the way it is for DSA+CC/CC-only, unless a `uuid` genuinely holds more than one DCA row (open question, not confirmed either way — build the switcher defensively but don't assume it will commonly show >1 tab).

### 7.1 User card

**Purpose:** identify the merchant and give the headline status of their DCA application.

**Contents**
- Identity: name (business/proprietor), phone, email, `uuid`.
- Headline status: one status label (Active / Stuck / In Review / Pending / Blocked / Abandoned) + a one-line summary (e.g. "Udyam not verified — mandatory block", "Account not created").
- Application meta: DCA type badge, application identifier, `updated_at` (the one timestamp the snapshot source reliably gives), `business_verification_status`.
- Source-channel note (`uid_db_gold.customers.source_channel`) shown as supporting context, not headline (join correctness unconfirmed, §13).

**Behaviours & rules**

| # | Requirement |
|---|---|
| U-1 | If a second in-scope DCA application somehow exists for the same `uuid`, switching re-renders every per-application card (mirrors DSA+CC U-1), but this is a defensive build, not an expected common case. |
| U-2 | Missing values show as "—"; long values never cropped. |
| U-3 | `uuid` and application identifier are copyable. |
| U-4 | **If the application is EDI (`ONBOARDING_PLATFORM_SYNC` present):** the User card itself must show the "this is EDI, not DCA" message instead of a headline status — never a DCA-shaped headline over EDI data (§5.4). |

### 7.2 Alerts card

**Purpose:** surface what is actively wrong for this DCA merchant, ranked, before the agent reads the whole journey.

#### 7.2.1 How alerts are generated

Derived, not stored — evaluated against the data fetched for the `uuid` (§5.6). Each rule fires at most once per application; read-only (states what, never what-to-do).

#### 7.2.2 Inputs each rule reads

| Source | Fields |
|---|---|
| `slice_x_application_base` | `state`, `flags`, `updated_at`, `business_verification_status` |
| `slice_x_redflags` | `reason`, `isdeleted`, `validated`, `blocker` |
| `vkyc_details` | `status`, `rejection_reason`, `product_flow=15` |
| `business_details` | `gst_number` (empty-hash aware), `udyam_aadhaar_number` (empty-hash aware) |
| `bureau_id_gstin_advanced_details` | presence of a row (any `product_flow`) |
| `user_states` | `property_value='CURRENT_ACCOUNT_CREATED'` presence |

#### 7.2.3 Prioritisation & completeness

Same 3-key sort as the DSA+CC tool: severity (P0 → P1 → info) → journey position (earliest blocking milestone first) → catalog order. No cap; card scrolls if long. Overlapping root-cause alerts both show; only the same rule is prevented from firing twice.

#### 7.2.4 Rule catalog

| Sev | Condition | Title | Owner |
|---|---|---|---|
| P0 | `slice_x_redflags.reason = USER_BLACKLISTED` (validated/blocker, not deleted) | Fraud hard block / blacklisted | Fraud squad |
| P0 | last flag ≈ `KYC_APPROVED` (or `state` reflects approval) **and** no `CURRENT_ACCOUNT_CREATED` property row in `user_states` | Account not created | A2 *(assumed owner — confirm)* |
| P0 | `vkyc_details.status = 'REJECTED'` (`product_flow=15`) | VKYC rejected — {rejection_reason} | VKYC ops |
| P0 | `slice_x_redflags.reason = UDYAM_NOT_VERIFIED` and Business Details not passed | Udyam not verified — mandatory block | GST/Udyam verification owner *(assumed — confirm)* |
| P1 | `slice_x_redflags.reason ∈ {PAN_DEDUPE_EXISTS_WITH_DIFFERENT_UUID, EXISTING_BANK_USER, *_EXISTS_WITH_DIFFERENT_UUID_IN_{MINI,SAVINGS,BORROW}_ONBOARDING}` | Dedupe conflict — existing account | UID team |
| P1 | `slice_x_redflags.reason = GST_NOT_VERIFIED` | GST not verified *(non-gating today — informational, not a hard block; see §0.4)* | GST/Udyam verification owner *(assumed)* |
| P1 | `vkyc_details.status` pending / not yet decided (`product_flow=15`) | VKYC pending | VKYC ops |
| P1 | last flag = `MOVED_TO_AUDIT` and no `KYC_APPROVED`/`KYC_DECLINED` yet | In audit review since {`updated_at`} *(entry timestamp only — the snapshot gives no separate "when did audit start" field; `updated_at` is a proxy, flag as such)* | Review/Audit team |
| P1 | `state = REJECTED` **and** no matching row in `slice_x_redflags` at all | Rejected — no red flag found; investigate | A2 *(assumed)* |
| info | `flags LIKE '%ONBOARDING_PLATFORM_SYNC%'` | Out of scope — this is an EDI application, not DCA | — *(routes to the EDI tool, not a DCA owner)* |
| info | no forward movement for a long time (display heuristic — inactivity window TBD, Q-DCA-mirror-Q8) | Abandoned — no activity since {`updated_at`} | — |
| info | *(if/when a reset signal is confirmed, §9)* | Journey reset — from {step} | — *(placeholder — gated on Q-DCA-4)* |

#### 7.2.5 Behaviours & rules

Same A-1…A-8 requirements as the DSA+CC tool (sorted, plain-language, show-all, state-not-action, wrapping, per-application re-evaluation, CLEAR-only-if-critical-sources-resolved, absence-never-treated-as-alert). One addition specific to DCA:

| # | Requirement |
|---|---|
| A-9 (DCA) | **An EDI-flagged application never shows a DCA Alerts card at all** — it shows the out-of-scope message instead (mirrors A-out-of-scope in the DSA+CC tool, but the trigger condition here is `ONBOARDING_PLATFORM_SYNC`, not a product-type field). |
| A-10 (DCA) | **"CLEAR" requires the redflags source and the account-creation (`user_states`) source to both have resolved** — these are this domain's critical sources, standing in for the DSA+CC tool's "fraud + account-status + bureau." |

---

### 7.3 Checks card

**Purpose:** answer the highest-frequency DCA root-cause questions in one place — outcome + reason + time (where the source gives a time).

**The checks**

| Check | Outcomes | Notes |
|---|---|---|
| **Fraud / redflag** | Clear · Fraud hard block · Dedupe conflict · Audit declined · Flagged (other) · N/A | Priority-bucketed per §Appendix D — fraud > FIA > audit > VKYC-agent > redflag/dedupe > other, so a merchant with multiple redflag rows shows one bucketed outcome, not a double-count. |
| **GST verification** | Verified · Not verified (non-gating) · N/A | Verified = non-empty-hash `business_details.gst_number` **or** a row in `bureau_id_gstin_advanced_details` (any `product_flow`). **Non-gating today** — showing "Not verified" is informational, not a block (§0.4). |
| **Udyam verification** | Verified · Not verified — mandatory block · N/A | Verified = non-empty-hash `business_details.udyam_aadhaar_number`. **Mandatory today** — "Not verified" is a hard gate at Business Details. No confirmed auto-fetch signal exists (see the capability-gap note below) — the row cannot distinguish "merchant hasn't submitted it" from "it was auto-fetched but failed," it can only say verified/not. |
| **VKYC** | Approved · Rejected (+ reason) · Pending · Not reached | `product_flow=15`. |
| **Audit review** | Under review · Approved (post-audit) · Declined (`CONCURRENT_AUDIT_REVIEW_DECLINED`) · Not triggered | From `MOVED_TO_AUDIT` presence + terminal `KYC_APPROVED`/`KYC_DECLINED`. |

> **Capability gap, not a bug (call this out to agents in training):** EDI has a `udyam_ref`-style confirmed-autofetch signal (`onboarding_v2_gold.udyam_autofetch.is_confirmed` — though note that field is *always false* even on the EDI side, so it's not reliable there either). **DCA has no autofetch-confirmation signal at all** — Udyam for DCA is captured only via manual submission (`UDYAM_AADHAAR_SUBMITTED`). The Checks card must not imply an auto/manual distinction it cannot back up.

**Rows deliberately NOT included here (open questions, not silent omissions):**
- **AML** — no DCA-specific AML source was given; do not assume the DSA+CC tool's `amlstatus` field applies here without confirmation (Q-DCA-6).
- **Bureau stop** — a CC-scope concept from the DSA+CC tool; no evidence a current-account flow has an equivalent bureau check. Omitted, not assumed absent-therefore-hidden — flag as open (Q-DCA-6).
- **Risk decisioning** — no DCA-specific risk-decision table was given.
- **SIM binding** — plausible that it's shared per-user infrastructure across products, but no DCA-specific source was confirmed; omit rather than invent (Q-DCA-6).
- **Current Account created** — deliberately kept **out** of the Checks card, mirroring the DSA+CC tool's own design choice to keep "account not created" in Alerts (P0) + Event delivery + the Account-creation milestone only, never as a Checks row (§7.0 "intentional overlaps" pattern).

**Behaviours & rules**

| # | Requirement |
|---|---|
| C-1 | Every row shows outcome + reason (fully readable, wraps) + time where the source provides one. |
| C-2 | Fraud/redflag: no data → "N/A", never assume "clear." |
| C-3 | GST row never implies a hard block — "Not verified" reads as informational, matching the current non-gating policy (§0.4). If the proposed "GST OR Udyam" rule ships, this row's copy must be revisited — do not pre-emptively soften it now. |
| C-4 | Udyam row **does** read as a hard block when "Not verified" and Business Details hasn't otherwise passed — matching the current mandatory policy. |
| C-5 | Row order: Fraud/redflag → GST → Udyam → VKYC → Audit review. |
| C-6 | Every row populates with the latest value at lookup, never cached. |

---

### 7.4 Event delivery card

**Purpose:** expose silent failures — where the merchant's flags string looks like it's progressing but a downstream confirmation never landed.

**Architectural caveat (must be visible in the UI copy, not just this doc):** because DCA's primary source is a snapshot rather than an event log (§0.1), "Received" on this card means **"the corresponding flag/property is present in the current fetch,"** not **"we observed a discrete timestamped delivery event."** This is a materially weaker guarantee than the DSA+CC tool's webhook-received semantics, and the card copy should say so (e.g. a small "as of last fetch, not an event trace" note in the card header) rather than implying parity it doesn't have.

**Events covered (as available, sourced without inventing a table)**

| Event (as shown) | Source | Caveat |
|---|---|---|
| Business Details submitted | `flags` contains `BUSINESS_DETAILS_SUBMITTED` | flag-presence, not a timestamped event |
| VKYC decision | `vkyc_details` row exists with terminal `status` | this table does carry its own timestamp column, so this row is the closest thing to a real "event" on this card |
| Moved to audit | `flags` contains `MOVED_TO_AUDIT` | flag-presence |
| **Current Account created** | `user_states` row with `property_value='CURRENT_ACCOUNT_CREATED'` | this is the load-bearing row — pairs with the Alerts P0 and the Account-creation milestone (§7.0 intentional-overlap pattern) |

**Behaviours & rules**

| # | Requirement |
|---|---|
| E-1 | The account-creation confirmation row is the account-not-created diagnosis, paired with the Alerts P0 and the Account-creation milestone. |
| E-2 | Statuses are unambiguous: Received / Not received / Pending. |
| E-3 | If nothing is trackable for the application (e.g. very early-stage), say so explicitly. |
| E-4 | Event names and times stay fully readable. |
| E-5 (DCA) | The card header must disclose the snapshot-vs-event-log caveat above — this is not optional polish, it is the honesty requirement from §0.1 applied to this specific card. |

---

### 7.5 Onboarding journey card

**Purpose:** show the merchant's position in the DCA funnel, what's known at each milestone, and exactly where it broke.

**Contents**
- A header showing progress ("milestone X of N") — computed from the **last flag reached**, not a count of discrete completed events (§7.6 note).
- A vertical list of milestones (§8.0), each with a status and a plain-language detail — **timestamped only where the underlying table genuinely carries a timestamp** (VKYC decision, audit-review-related `updated_at`, account-creation property); earlier milestones show "—" for time rather than a fabricated derived timestamp, unlike the DSA+CC prototype's `deriveTs` convenience (that convenience exists there because a real event log backs it; it would be dishonest here).
- GST/Udyam shown as an **attribute** on the Business Details milestone (verified/not-verified + empty-hash-aware), not as separate milestones — mirrors the DSA+CC tool's "dedupe is an attribute, not a milestone" pattern.
- Dedupe shown as an attribute at the same checkpoints redflags actually fire at: PAN/Business-Category and pre-account-creation.

**Behaviours & rules**

| # | Requirement |
|---|---|
| J-1 | Each milestone has one clear status: Done · Stuck · Warning · Pending · Skipped · Reset (Reset gated on Q-DCA-4 — see §9). |
| J-2 | The current milestone (last flag) is highlighted; header progress reflects it. |
| J-3 | The GST/Udyam attribute on Business Details is explicit about which is verified, which isn't, and which one is currently the gating one (Udyam). |
| J-4 | Outcome blocks (VKYC rejection reason, audit decline reason, redflag block reason) carry the actual reason string, never just a generic state. |
| J-5 | **Milestones do not claim a timestamp they don't have** — this is the single most important honesty rule in this PRD, given §0.1. A milestone with no backing timestamp source shows "—", not a derived/interpolated time. |
| J-6 | Long milestone names/details/reasons wrap, never cropped. |
| J-7 | Depth-on-demand: a milestone with underlying detail (VKYC scores/reasons, redflag match evidence, GST/Udyam raw values) offers click-to-expand. |
| J-8 | **No full raw event log is offered** for DCA (unlike the DSA+CC tool's J-10) — there is no event log to show. The "full event log" affordance is replaced with a short note: "DCA's source is a state snapshot; a full action history is not available from this source (see Open Questions)." |

§8 specifies the milestone-by-milestone content and probable cases.

---

### 7.6 Timeline logic rules

**These are proposed by direct analogy to the DSA+CC tool's §7.6 — confirm against actual DCA state-machine behaviour before build, since the underlying data shape (snapshot vs log) is different enough that some of this ladder may not transfer cleanly.**

**A. Progress denominator ("milestone X of N")**
- N = the 10 canonical DCA milestones (§8.0). X = the milestone implied by the last flag in `flags`.
- If `to_visit_screen` and the last-flag-derived position disagree, **trust the flags-derived position** (canonical) and show `to_visit_screen` only as a secondary/legacy data point on that milestone — never silently pick whichever is more "convenient."

**B. Status precedence (highest wins)**
1. Blocked (fraud / dedupe / Udyam-mandatory-gate) — hard stop
2. Stuck — merchant cannot proceed
3. Reset — *(placeholder pending Q-DCA-4 — do not build this tier until reset behaviour is confirmed for DCA)*
4. Warning — done, with a caveat (e.g. GST not verified, non-gating)
5. Done
6. Skipped / Pending

**C. Application status derivation** — proposed, first match wins:

| # | Display status | Condition |
|---|---|---|
| 1 | **Blocked** | `USER_BLACKLISTED` redflag active, or Udyam-mandatory gate unmet at Business Details, or `state = REJECTED`. |
| 2 | **In Review** | Last flag = `MOVED_TO_AUDIT` and no terminal decision yet. |
| 3 | **Active** | Terminal `KYC_APPROVED` **and** `CURRENT_ACCOUNT_CREATED` property present. |
| 4 | **Stuck** | Reached a milestone it can't pass and it's neither a review nor a hard block — e.g. `KYC_APPROVED` but no account-creation property (account-not-created), or a VKYC-rejected state awaiting redo. |
| 5 | **Abandoned** | No forward movement for a long time (display heuristic — inactivity window TBD) and none of the above. |
| 6 | **Pending** | Default — early/mid journey, still progressing normally. |

**D. Milestone status derivation** — per milestone, from the last-flag position:

| Milestone status | Condition |
|---|---|
| **Done** | A later flag than this milestone's own flag is present in `flags` (i.e. the journey has moved past it). |
| **Stuck** | This milestone's flag is the last one present, **and** `updated_at` is old enough to suggest no forward movement (heuristic, not a log-backed "stuck since"). |
| **Blocked** | A hard-block redflag or the Udyam-mandatory gate applies at this milestone. |
| **Pending** | Not yet reached — no evidence in `flags`/`to_visit_screen`. |
| **Reset** | *(placeholder — Q-DCA-4)* |

> **Honesty note carried through from §0.1:** because `flags` is a snapshot, "Done" here means "a later flag exists," not "we have a timestamped completion event." The UI must not phrase this as if it were the DSA+CC tool's action-log-backed derivation.

---

## 8. The Onboarding Journey — Milestones & Probable Cases

### 8.0 Canonical milestone model

**Fixed skeleton, derived from the LAST flag present in `split(flags, ',')`** (canonical — preferred over `to_visit_screen`, which is documented as a secondary/legacy signal below):

```
Consent / TnC → PAN Screen → Business Category (CKYC check) → Business Details (GST/Udyam)
   → Aadhaar / Digio → Verify Details (PRE_VKYC) → VKYC → Audit review
   → Decision (Approved / Rejected) → Current Account creation
```

**Milestone → last-flag mapping (canonical):**

| Milestone | Reached-position signalled by flag |
|---|---|
| 1. Consent / TnC | `CONSENT_CAPTURED` (or `BUSINESS_PAN_SKIPPED` — an alternate path where business PAN entry is skipped) → user is now at the **PAN Screen** |
| 2. PAN Screen | `CKYC_SKIPPED` → user is now at **Business Category** |
| 3. Business Category (CKYC check) | `PAN_VERIFIED` → user is now at the **Business Details Screen** |
| 4. Business Details (GST/Udyam) | `BUSINESS_DETAILS_SUBMITTED` → user is now at **AADHAR/DIGIO** |
| 5. Aadhaar / Digio | `DETAILS_VERIFIED` → user is now at **PRE_VKYC** |
| 6. Verify Details (PRE_VKYC) | `VKYC_VERIFIED` → user is now at **VKYC_COMPLETED** |
| 7. VKYC | `MOVED_TO_AUDIT` → user is now in **audit review** |
| 8. Audit review | `KYC_APPROVED` → **APPROVED**, or `KYC_DECLINED` → **REJECTED** |
| 9. Decision | terminal |
| 10. Current Account creation | `user_states.property_value = 'CURRENT_ACCOUNT_CREATED'` present (separate table, not a `flags` value) |

**Secondary / legacy position signal — `to_visit_screen`:** an older/alternate variant keys on this field instead of `flags`: `CONSENT_SCREEN` = TnC, `NO_SKIP_PAN_SCREEN` = PAN, `BUSINESS_DETAILS_PLATFORM`, `DIGIO`, `VKYC_SCREEN_PLATFORM`, `ONBOARDED` = Applied. Document and show this as supporting detail on the relevant milestone; **do not treat it as canonical** — where it disagrees with the flags-derived position, the flags model wins (§7.6-A).

**GST/Udyam is an attribute on Milestone 4 (Business Details), not its own milestone** — mirrors the source PRD's "dedupe is an attribute, not a milestone" pattern:
- **GST** — Verified (non-empty-hash `business_details.gst_number` OR a row in `bureau_id_gstin_advanced_details`) · Not verified (non-gating today).
- **Udyam** — Verified (non-empty-hash `business_details.udyam_aadhaar_number`) · Not verified (**mandatory gate — blocks progress today**).

**Dedupe is an attribute, not a milestone**, at the checkpoints redflags actually cover: PAN/Business Category (PAN dedupe, existing-bank-user, cross-product dedupe) and pre-account-creation (any late-stage redflag). Source: `slice_x_redflags`.

> **Milestone status/timestamp derivation:** per §7.6-D. Timestamp = "—" unless the specific milestone has a genuinely timestamped backing table (VKYC, audit-adjacent `updated_at`, account-creation property) — never a derived/interpolated value (J-5).

Each case table below: **Probable case → What the merchant/CX experiences → What the dashboard must show → Owner.** Unlike the source PRD, these are **not** ranked by real escalation volume (no corpus exists yet, §1) — they are structured from the verified redflag/rejection/verification taxonomy in §5.5/Appendix D.

---

### Milestone 1 — Consent / TnC
**Happy path:** consent captured → proceed to PAN Screen.

| Probable case | Experience | Dashboard must show | Owner |
|---|---|---|---|
| Business PAN entry skipped (`BUSINESS_PAN_SKIPPED` path) | Merchant proceeds without the usual PAN-first flow | Which path was taken (`CONSENT_CAPTURED` vs `BUSINESS_PAN_SKIPPED`) | A2 *(assumed)* |
| Stuck before consent captured | "Nothing happens on the first screen" | No flags present at all — application effectively hasn't started; distinguish from a genuinely new/unsubmitted app | A2 *(assumed)* |

---

### Milestone 2 — PAN Screen
**Happy path:** business PAN entered → CKYC check runs → skipped/cleared → proceed to Business Category.

| Probable case | Experience | Dashboard must show | Owner |
|---|---|---|---|
| PAN dedupe conflict | "Can't proceed" | `PAN_DEDUPE_EXISTS_WITH_DIFFERENT_UUID` redflag + the conflicting `uuid` | UID team |
| Cross-product dedupe (mini/savings/borrow) | "Can't proceed," confusing because merchant thinks this is a new product | The specific `*_EXISTS_WITH_DIFFERENT_UUID_IN_{MINI,SAVINGS,BORROW}_ONBOARDING` reason + which product it collided with | UID team |
| Existing bank user | "Already have an account, why blocked?" | `EXISTING_BANK_USER` redflag | UID team *(assumed — may also be Fraud, confirm)* |

---

### Milestone 3 — Business Category (CKYC check)
**Happy path:** CKYC check runs, skipped for business flow → proceed to PAN verification.

| Probable case | Experience | Dashboard must show | Owner |
|---|---|---|---|
| Stuck at Business Category with no forward flag | "Selected category, nothing happens" | Last flag = `CKYC_SKIPPED`, no `PAN_VERIFIED` yet; `updated_at` age | A2 *(assumed)* |

> No richer probable-case detail is available for this milestone from the given schema facts — flag as a gap for the eventual DCA escalation-corpus pass (Q-DCA-1), not filled with invented detail.

---

### Milestone 4 — Business Details (GST / Udyam)
**Happy path:** business details entered → Udyam verified (mandatory) → GST captured (optional today) → proceed to Aadhaar/Digio.

| Probable case | Experience | Dashboard must show | Owner |
|---|---|---|---|
| **Udyam not verified — mandatory block** | "Stuck, can't move past business details" | `UDYAM_NOT_VERIFIED` redflag / empty-hash `udyam_aadhaar_number` + explicit "mandatory — this is the gate" framing | GST/Udyam verification owner *(assumed)* |
| GST not verified (non-gating) | Merchant/CX assumes this is blocking when it isn't | `GST_NOT_VERIFIED` redflag / empty-hash `gst_number`, labelled clearly as **not** a current block | GST/Udyam verification owner *(assumed)* |
| GST "missing" false alarm — empty-hash misread as absent | CX reports "no GST on file" when a value technically exists | The raw empty-hash vs a real value, so the agent isn't misled by a `column IS NOT NULL` check that always passes | A2 *(data-contract awareness, not a real block)* |
| Udyam captured manually, agent asked "was this auto-fetched?" | CX can't answer — no signal exists | Explicit "manual submission only — no auto-fetch confirmation signal exists for DCA" note, rather than a fabricated auto/manual field | — *(capability gap, not routable — see §13)* |
| `merchant_info.gst_no` disagrees with `business_details.gst_number` | CX confused by two different GST values | Do not surface `merchant_info.gst_no` at all — it is a dead/untrustworthy column | A2 *(data hygiene note)* |

---

### Milestone 5 — Aadhaar / Digio
**Happy path:** Aadhaar/Digio verification completes → proceed to Verify Details.

| Probable case | Experience | Dashboard must show | Owner |
|---|---|---|---|
| Stuck at Aadhaar/Digio, no forward flag | "Uploaded documents, nothing happens" | Last flag = `BUSINESS_DETAILS_SUBMITTED`, no `DETAILS_VERIFIED` yet | A2 *(assumed)* |

> As with Milestone 3, no richer probable-case detail is available from the given schema facts for this specific step; flagged for the future corpus pass rather than invented.

---

### Milestone 6 — Verify Details (PRE_VKYC)
**Happy path:** details verified → proceed to VKYC.

| Probable case | Experience | Dashboard must show | Owner |
|---|---|---|---|
| Stuck at Verify Details | "Confirmed details, stuck" | Last flag = `DETAILS_VERIFIED`, no `VKYC_VERIFIED` yet | A2 *(assumed)* |

---

### Milestone 7 — VKYC
**Happy path:** VKYC call completes → approved → moved to audit.

| Probable case | Experience | Dashboard must show | Owner |
|---|---|---|---|
| **VKYC rejected** | Generic error, no reason shown today | `vkyc_details.rejection_reason` (granular reason, `product_flow=15`) | VKYC ops |
| **VKYC pending** | "Waiting, no update" | `vkyc_details.status` pending state | VKYC ops |
| VKYC decision present in both `vkyc_details` and a `slice_x_redflags` row | Double-counted as two separate problems | **Exclude `VKYC_REJECTED`/`VKYC_PENDING` reasons from the redflags fraud bucket** when `vkyc_details` is the VKYC source — same underlying signal, don't show it twice | VKYC ops / A2 (data-contract awareness) |

---

### Milestone 8 — Audit review
**Happy path:** moved to audit → reviewed → approved.

| Probable case | Experience | Dashboard must show | Owner |
|---|---|---|---|
| **In audit review, age unknown** | "Under review," no visible entry time | Last flag = `MOVED_TO_AUDIT`, `updated_at` as the best-available proxy for entry time (explicitly labelled as a proxy, not a true entry timestamp — §0.1) | Review/Audit team *(assumed)* |
| **Audit declined** | "Declined," no reason surfaced | `CONCURRENT_AUDIT_REVIEW_DECLINED` redflag, labelled "audit_declined" | Review/Audit team *(assumed)* |

---

### Milestone 9 — Decision (Approved / Rejected)
**Happy path:** `KYC_APPROVED` → proceed to account creation.

| Probable case | Experience | Dashboard must show | Owner |
|---|---|---|---|
| **Rejected with no matching redflag ("other")** | "Declined but I have no issues" | `state=REJECTED` with zero rows in `slice_x_redflags` for this `uuid` — explicit "no red flag found; flag for investigation" (mirrors the source PRD's Milestone-9 pattern exactly) | A2 *(assumed)* |
| Rejected — fraud bucket | Blocked, no explanation | `USER_BLACKLISTED` etc., already surfaced at whichever milestone the redflag actually fired | Fraud squad |

---

### Milestone 10 — Current Account creation
**Happy path:** approved → `CURRENT_ACCOUNT_CREATED` property set → active.

| Probable case | Experience | Dashboard must show | Owner |
|---|---|---|---|
| **Account not created (P0 — the DCA analogue of the source PRD's largest bucket)** | "KYC done, no account" | `KYC_APPROVED` reached, no `CURRENT_ACCOUNT_CREATED` property row in `user_states`; core-banking (`bsgcore_gold`/`bsgaccounting_gold`) cross-check where available | A2 *(assumed)* |
| Approved but core-banking confirmation absent/delayed | "Says approved, no account visible in banking systems" | Approval state vs core-banking presence side by side | A2 *(assumed)* |

---

## 9. Reset & Re-onboarding

**Open question, not a confirmed feature (Q-DCA-4).** The DSA+CC tool's reset model — a reset creates a **new** `application_id`, the old one flips to `RESET`, both visible via `selectionStrategy=all` — is a *confirmed, Slack-verified* behaviour for that flow. **No equivalent confirmation exists for DCA.** Do not assume DCA resets the same way; possibilities include (untested): a new row keyed by a new identifier, an in-place `flags`/`state` rewrite on the same row, or no supported reset path at all for DCA today.

If reset UI is built ahead of that confirmation (e.g. to keep visual parity with the DSA+CC tool for this same-family product), it must be **explicitly gated**: any reset-related banner or badge in the prototype must carry a visible "(assumed — unconfirmed for DCA)" marker, and the underlying detection logic must be written so that in production it fails safe (shows nothing) rather than guessing at a reset that may not be representable in `slice_x_application_base`'s snapshot shape at all.

---

## 10. Cross-Cutting Cases

- **EDI vs DCA misclassification** — the single most important cross-cutting defensive case for this dashboard (not present in the DSA+CC tool, because that tool doesn't share a flag-taxonomy with a sibling flow the way DCA does with EDI). Any application with `ONBOARDING_PLATFORM_SYNC` in `flags` (or `updated_by='onboarding_v2'`) must render the explicit out-of-scope message, never DCA milestones (§5.4, §7.2.5 A-9).
- **Snapshot-vs-event-log honesty** — every card that would, in the DSA+CC tool, show a timestamp derived from an event log must either show a real timestamp from a genuinely timestamped DCA table, or show "—". No derived/interpolated timestamps (J-5).
- **Empty-hash GST/Udyam** — a cross-cutting data-contract gotcha that affects the Checks card, the Business Details milestone, and any future aggregate query: never treat `IS NOT NULL` as sufic ient for "GST/Udyam present" on these two columns.
- **Defensive:** missing → "—"/"N/A" never blank/null · no DCA application → explicit message · EDI application → explicit message · long values never cropped · unknown state → neutral fallback.

---

## 11. Shared Status Vocabulary

**Application status:** Active · Stuck · In Review · Pending · Blocked · Abandoned. *(Reset omitted pending Q-DCA-4.)*
**Milestone status:** Done · Stuck · Warning · Pending · Skipped. *(Reset omitted pending Q-DCA-4.)*
**Fraud/redflag decision:** Clear · Fraud hard block · Dedupe conflict · Audit declined · Flagged (other) · N/A.
**GST verification:** Verified · Not verified (non-gating) · N/A.
**Udyam verification:** Verified · Not verified — mandatory block · N/A.
**VKYC:** Approved · Rejected · Pending · Not reached.
**Audit review:** Under review · Approved · Declined · Not triggered.
**Event delivery:** Received (flag/property present) · Not received · Pending — **with the snapshot-vs-event caveat from §7.4 always attached in the UI, not just this glossary.**

---

## 12. Non-Functional Product Expectations

| Area | Expectation |
|---|---|
| Access | Internal, authenticated CX/ops only; read-only. |
| Privacy | Shows personal + business data; need-to-know access; access logged. |
| **Freshness** | As-of-lookup, not live. Every field/card shows "as of &lt;time&gt;" + manual refresh — same discipline as the DSA+CC tool, arguably *more* important here given the snapshot source has no independent "this is stale" signal of its own. |
| **Reliability** | One source down → show the rest, mark that card "data unavailable." Critical sources (redflags, account-creation property) fail loudly; supporting sources degrade quietly. |
| Speed | Usable during a live call. |
| Readability | Nothing cropped or hidden. |

---

## 13. Open Product Questions

| # | Question | Why it matters |
|---|---|---|
| Q-DCA-1 | What does a real DCA escalation-thread corpus (analogous to the DSA+CC tool's 2,469-thread pull) actually show for bucket volumes and priorities? | Every share/priority in §1 is currently a placeholder; this is the single biggest gap versus the source PRD's evidentiary basis. |
| Q-DCA-2 | Does a DCA-side event-log / audit table exist anywhere (separate from `slice_x_application_base`) that would give real per-milestone timestamps? | Blocks the single biggest feature gap versus the DSA+CC tool — per-milestone timestamps. **Do not guess a table name; this must be answered by Eng, not assumed.** |
| Q-DCA-3 | Is the current GST-optional / Udyam-mandatory policy final, or will the proposed "GST OR Udyam" relaxation ship? When? | Directly changes the Checks-card semantics and the Business Details milestone's blocking logic (§0.4). |
| Q-DCA-4 | Does DCA support a reset / re-onboarding pattern at all, and if so does it mirror the DSA+CC tool's "new application_id, old flips to RESET" model, or something else entirely (in-place rewrite, no reset path)? | Determines whether §9's reset UI should ship at all, and in what form. |
| Q-DCA-5 | Is `uid_db_gold.customers.id = slice_x_application_base.uuid` actually a correct, reliable join — same key space, no collisions? | Affects the reliability of the `source_channel` context shown on the User card. |
| Q-DCA-6 | Do AML, bureau-stop, risk-decisioning, or SIM-binding equivalents exist for DCA (via a shared per-user source or a DCA-specific one), or are these genuinely DSA+CC/CC-only-only concepts? | Determines whether the Checks card is missing rows it should have, or is correctly scoped as-is. |
| Q-DCA-7 | What is the correct owner team for GST/Udyam verification, account-creation failures, and audit-review escalations? | The Appendix owner-routing map below is built on reasonable inference, not confirmed ownership — every "(assumed)" tag here needs an ops confirmation pass. |
| Q-DCA-8 | What inactivity window should drive the "Abandoned" status/alert for DCA? | Mirrors the source PRD's Q8 exactly — display heuristic, not an SLA, but needs a number. |
| Q-DCA-9 | Should a lookup key other than `uuid` (phone, business PAN, application id) be supported, and how should one key matching multiple merchants be handled? | Mirrors the source PRD's Q1; determines search behaviour. |
| Q-DCA-10 | Is there ever a legitimate case where a single `uuid` holds more than one DCA application row? | Determines whether the application-switcher UI (built defensively, §7.0) is ever actually exercised in production. |

---

## 14. Release Phasing

Cumulative addressable % **cannot be estimated** — no corpus exists (§1). Phasing below orders build effort by data-confidence, not by measured value, and should be revisited once Q-DCA-1 lands.

| Phase | Contents | Rationale |
|---|---|---|
| **P0 (MVP)** | Identity & application snapshot · last-flag position · Alerts (fraud/redflag, Udyam-mandatory, VKYC rejected, account-not-created) · Checks (fraud/redflag, GST, Udyam, VKYC, audit) · the EDI-vs-DCA out-of-scope guard. | These are the signals with the strongest schema confidence (§5.5) and require no timestamp guarantees beyond what the source tables genuinely carry. |
| **P1** | Event delivery card (with its snapshot-vs-event caveat) · dedupe/GST/Udyam attribute detail panels · audit-review entry-time proxy · "other"/no-redflag rejection investigation flag. | Completes the diagnosis P0 starts, still without requiring the event-log gap (Q-DCA-2) to close. |
| **P2** | Reset/re-onboarding UI (gated on Q-DCA-4) · per-milestone real timestamps (gated on Q-DCA-2) · additional lookup keys (Q-DCA-9) · AML/bureau/risk/SIM rows if Q-DCA-6 resolves in favour of adding them. | Everything here is blocked on an open question resolving first — deliberately sequenced last so P0/P1 aren't held hostage by unresolved data-availability questions. |

---

## Appendix — Owner Routing Map

**Every row below is inferred from the domain facts given, not confirmed with ops — treat every entry as "(assumed — confirm with ops)" even where not individually re-tagged.**

| Failure area | Owner (assumed — confirm with ops) |
|---|---|
| Fraud blocks, blacklist (`USER_BLACKLISTED`) | **Fraud squad** |
| Dedupe conflicts (PAN, existing-bank-user, cross-product) | **UID team** |
| GST / Udyam verification gaps | **GST/Udyam verification owner** *(team name not confirmed — likely a business-verification or KYC-ops subteam)* |
| VKYC rejection / pending | **VKYC ops** |
| Audit review (under review / declined) | **Review/Audit team** |
| Account creation, flag-position stuck cases, EDI/DCA routing | **A2** |
| "Other" rejections with no redflag (investigate) | **A2** |

---

## Appendix D — Data-contract & API mapping index

**Where each mapping lives:**

| Concern | Section |
|---|---|
| Identity & source model (snapshot vs event-log gap) | §5.3 |
| Field & fingerprint mapping | §5.5 |
| Fetch & selection strategy (parallel table reads) | §5.6 |
| Milestone → last-flag map | §8.0 |
| Application & milestone status derivation | §7.6-C / §7.6-D |

**Sources (current scope):**
- **`a2_onboarding_gold.slice_x_application_base`** — anchor snapshot, join key `uuid`, DCA filter `flags NOT LIKE '%ONBOARDING_PLATFORM_SYNC%'`.
- **`a2_onboarding_gold.slice_x_redflags`** — rejection/dedupe/fraud reasons, join `uuid`, filter `isdeleted=false AND (validated=true OR blocker=true)`.
- **`kycdb_gold.vkyc_details`** — VKYC outcome, `product_flow=15` for DCA (not 115/EDI, not 49/savings).
- **`kycdb_gold.business_details`** — GST/Udyam raw values, empty-hash-aware.
- **`kycdb_gold.bureau_id_gstin_advanced_details`** — additional DCA GST signal, mostly `product_flow=2`, not filtered by `product_flow`.
- **`user_state_repository_db_gold.user_states`** — `updated_by='onboarding-svc'` identifies DCA; `property_value='CURRENT_ACCOUNT_CREATED'` is the account-creation confirmation.
- **`uid_db_gold.customers`** — `source_channel`, join `customers.id = slice_x_application_base.uuid` (join correctness unconfirmed, Q-DCA-5).
- **`merchantdb_gold.merchant_info`** — `mode` (OFFLINE/ONLINE); `gst_no` column is dead, never use.
- **`bsgcore_gold` / `bsgaccounting_gold`** — core-banking / CA confirmation, supporting cross-check for account creation.
- **Explicitly NOT a source for anything in this PRD:** `onboarding_v2_gold.udyam_autofetch.is_confirmed` — EDI-side field, always false there, not reused for DCA.

**Key enums / values:**
- **`state`:** includes at least `REJECTED` (dated by `updated_at`); the full set of intermediate values was not enumerated in the source material — treat any value not explicitly listed in this PRD as unconfirmed, not absent.
- **`flags` (canonical, confirmed real):** `CONSENT_CAPTURED`, `BUSINESS_PAN_SKIPPED`, `CKYC_SKIPPED`, `PAN_VERIFIED`, `BUSINESS_DETAILS_SUBMITTED`, `DETAILS_VERIFIED`, `VKYC_VERIFIED`, `MOVED_TO_AUDIT`, `KYC_APPROVED`, `KYC_DECLINED`, `ONBOARDING_PLATFORM_SYNC`.
- **`flags` (confirmed NOT real — do not invent as data fields):** `GST_PROVIDED`, `UDYAM_SUBMITTED`, `CPV_DONE`.
- **`to_visit_screen` (secondary/legacy):** `CONSENT_SCREEN`, `NO_SKIP_PAN_SCREEN`, `BUSINESS_DETAILS_PLATFORM`, `DIGIO`, `VKYC_SCREEN_PLATFORM`, `ONBOARDED`.
- **`slice_x_redflags.reason` (rejection/decline taxonomy):** `USER_BLACKLISTED`, `EXISTING_BANK_USER`, `PAN_DEDUPE_EXISTS_WITH_DIFFERENT_UUID`, `*_EXISTS_WITH_DIFFERENT_UUID_IN_{MINI,SAVINGS,BORROW}_ONBOARDING`, `GST_NOT_VERIFIED`, `UDYAM_NOT_VERIFIED`, `VKYC_REJECTED`, `VKYC_PENDING` (exclude these two when `vkyc_details` is the VKYC source), `CONCURRENT_AUDIT_REVIEW_DECLINED` ("audit_declined"). Priority order for bucketing: fraud > FIA > audit > VKYC-agent > redflag/dedupe > other; "other" = `REJECTED` count minus all matched buckets.
- **`product_flow` (VKYC/GST convention):** DCA VKYC = `15`; EDI VKYC = `115`; savings VKYC = `49`; DCA GST rows in `bureau_id_gstin_advanced_details` are mostly `2` (do not filter that table by `15`).

**Nothing in this appendix is "resolved" the way the source PRD's Q5/Q6 were — every mapping above is the current best understanding from prior verified analysis, not a Slack-confirmed contract. Treat §13 as the live list of what still needs confirmation before this PRD could reach the source PRD's "reconciled" status.**

---

*v0.1 — concept-adaptation PRD for the DCA channel, built from verified schema/funnel facts and structured to mirror `PRD_ops_dashboard.md`'s rigor. Unlike that document, this one has NOT been reconciled against a real escalation corpus or a Slack-verified data contract — §0 and §13 are not decorative, they are the actual current state of this PRD's evidentiary basis.*
