# Ops Dashboard (DCA) — Concept Summary
**For concept validation against real data — this channel has NOT yet been validated against a real escalation corpus**
Adapted from `dashboard_concept_summary.md` (DSA+CC / CC-only)

---

## Problem

CX and on-call ops have no single place to look up a **current-account (DCA) merchant's** onboarding state. Today, resolving a ticket means jumping between `a2_onboarding_gold`, `kycdb_gold`, `merchantdb_gold`, and Slack — often without a clear picture of where the merchant is stuck (which flag last fired) or why (which redflag, which verification gap).

This is the same structural problem the DSA+CC/CC-only tool was built to solve, for a different flow with a materially different underlying data shape: DCA's source is a **state snapshot**, not an event log.

---

## What we built (prototype)

A read-only internal lookup tool, same shell as the DSA+CC tool. Agent types in a `uuid`. Dashboard shows:

### 1. User card
- Name, phone, email, `uuid`
- Headline status (Active / Stuck / In Review / Pending / Blocked / Abandoned)
- Application meta: last-flag position, `updated_at`, `business_verification_status`
- **New guard:** if the application is actually EDI (`ONBOARDING_PLATFORM_SYNC`), the card shows an explicit "this is EDI, not DCA" message instead of any DCA-shaped data

### 2. Alerts card
- Derived P0/P1/info flags: fraud/blacklist, Udyam-not-verified (mandatory block), VKYC rejected/pending, dedupe conflicts, GST-not-verified (informational), audit-declined, "rejected with no matching redflag"
- CLEAR only when the critical sources (redflags, account-creation property) both resolved

### 3. Checks card

| Check | What it shows |
|---|---|
| Fraud / redflag | Clear · Fraud hard block · Dedupe conflict · Audit declined · Flagged (other) · N/A |
| GST verification | Verified · Not verified (non-gating today) · N/A |
| Udyam verification | Verified · Not verified — **mandatory block** · N/A |
| VKYC | Approved · Rejected (+ reason) · Pending · Not reached |
| Audit review | Under review · Approved · Declined · Not triggered |

**Dropped versus the DSA+CC tool's Checks card:** AML, Bureau stop, Risk decisioning, SIM binding — no confirmed DCA-specific source exists for any of these (open question, not a silent omission).

### 4. Event delivery card
Flag/property presence for Business Details submission, VKYC decision, moved-to-audit, and — the load-bearing one — Current Account creation. **Every row carries a caveat**: because DCA's source is a snapshot, "Received" means "present in this fetch," not "we observed a timestamped delivery event." This caveat is new to this channel; the DSA+CC tool doesn't need it because its source genuinely is an event log.

### 5. Onboarding journey (timeline)
Ten canonical milestones (Consent/TnC → PAN Screen → Business Category → Business Details [GST/Udyam attribute] → Aadhaar/Digio → Verify Details → VKYC → Audit review → Decision → Current Account creation), each derived from the **last flag** present in the `flags` string. Most milestones show "—" for timestamp rather than a fabricated one — only VKYC, audit-adjacent `updated_at`, and the account-creation property genuinely carry a time.

**No full raw event log** — unlike the DSA+CC tool, there is no event log to show.

---

## Scope — this version

| In scope | Out of scope |
|---|---|
| DCA (legacy/direct current-account onboarding, `updated_by='onboarding-svc'`) | EDI / merchant_lending (`updated_by='onboarding_v2'`, `ONBOARDING_PLATFORM_SYNC`) — teammate's follow-up |
| | Savings / mini / borrow onboarding |
| | Post-onboarding CA servicing |

---

## Key design decisions to validate

### D1 — Snapshot, not event log
DCA's primary source (`slice_x_application_base`) gives a current-state `flags` string, not a timestamped action log. "Where is the merchant now" is derivable (last flag); "when did each milestone happen" mostly isn't.

**Validate:** Does any DCA-side table carry real per-milestone timestamps that we haven't identified? (PRD Q-DCA-2 — do not guess a table name, ask Eng.)

### D2 — GST optional, Udyam mandatory (today)
The Checks card and the Business Details milestone treat Udyam-not-verified as a hard block and GST-not-verified as informational only, matching the *current* policy.

**Validate:** Is there a firm date for the proposed "GST OR Udyam" relaxation? Should the tool ship a policy-version flag so this doesn't silently go stale? (PRD Q-DCA-3)

### D3 — EDI vs DCA is a routing guard, not a data problem
Any application carrying `ONBOARDING_PLATFORM_SYNC` gets an explicit out-of-scope message rather than being rendered through the DCA milestone map (which would produce nonsense, since the flag taxonomies diverge).

**Validate:** Is `ONBOARDING_PLATFORM_SYNC` presence a clean, exclusive signal, or are there DCA apps that carry it for unrelated reasons?

### D4 — One `uuid`, (probably) one DCA application
Unlike DSA+CC's one-`uuid`-many-applications model, nothing in the given schema facts suggests a DCA merchant commonly holds more than one DCA application. The application switcher is built defensively but demoted visually.

**Validate:** Does this hold in practice? (PRD Q-DCA-10)

### D5 — Reset behaviour is unconfirmed for DCA
The DSA+CC tool's reset model (new `application_id`, old flips to `RESET`) is Slack-verified for that flow. Nothing confirms DCA works the same way.

**Validate:** Does DCA support a reset path at all, and if so, what does it actually do to the underlying row? (PRD Q-DCA-4)

### D6 — Escalation-bucket priorities are inferred from the rejection taxonomy, not measured
Every bucket in the PRD's §1 is qualitative — built from the real redflag/verification taxonomy, not from a labelled thread corpus (none exists yet for DCA).

**Validate:** Pull and label a DCA-specific escalation sample (PRD Q-DCA-1) before quoting any of this as a volume estimate.

---

## What this dashboard does NOT do

- No write actions — cannot resolve dedupe, override the Udyam gate, or trigger a reset
- No Freshdesk integration
- No real-time push — refreshed on lookup
- **No full historical journey view** — the source itself doesn't have one to show (unlike the DSA+CC tool, which has one but chose not to show it as the default view)
- No agent SOP
- **No EDI data, ever, under any circumstance** — this is a hard scope guard, not a soft preference

---

## Test cases built

See `test_cases.md` — covers happy path, fraud/blacklist, PAN dedupe, GST-not-verified-but-Udyam-present, Udyam-not-verified (mandatory block), VKYC rejected, VKYC pending, audit-declined, approved-but-account-not-created, "other"/no-redflag rejection, an (assumed-gated) reset scenario, and the EDI-flagged out-of-scope scenario. Materially fewer cases than the DSA+CC tool's 58+ — this reflects a first concept pass, not a claim of equivalent coverage.

---

## What we need to validate

1. **Event-log gap** — does a real per-milestone timestamp source exist anywhere for DCA? (Q-DCA-2)
2. **GST/Udyam policy timeline** — is the mandatory/optional split stable, or about to change? (Q-DCA-3)
3. **Reset mechanism** — does it exist for DCA, and how? (Q-DCA-4)
4. **Join correctness** — is `uid_db_gold.customers.id = slice_x_application_base.uuid` actually reliable? (Q-DCA-5)
5. **Missing Checks rows** — do AML / bureau-stop / risk-decisioning / SIM-binding equivalents exist for DCA via some source we haven't been given? (Q-DCA-6)
6. **Ownership** — every team name in the Appendix routing map is inferred, not confirmed. (Q-DCA-7)
7. **Abandoned threshold** — what inactivity window should drive the Abandoned status? (Q-DCA-8)
8. **Real escalation coverage** — once a DCA thread corpus exists, do these probable cases match what ops actually sees day-to-day? (Q-DCA-1)
