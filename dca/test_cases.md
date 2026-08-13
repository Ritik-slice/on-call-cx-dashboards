# DCA Onboarding Dashboard — Test Cases

**Scope: DCA (legacy/direct current-account onboarding) only.**
EDI / merchant_lending (`ONBOARDING_PLATFORM_SYNC`) is explicitly out of scope — see case #12, which exercises the guard rather than DCA milestones.

Enter the key in the dashboard search bar (or use the QA · Test cases panel) to load the state.
**Staging UUID** column is blank — the `uuid` values embedded in the prototype are illustrative, not real production identifiers; fill in real staging/prod UUIDs once a DCA lookup is wired to live data.

Materially fewer cases than the DSA+CC/CC-only tool's 58+ (`test_cases.md` there) — this is a first concept pass covering the scenarios named in the build brief, not a claim of equivalent escalation-corpus coverage. See `PRD_ops_dashboard_dca.md` §13 (Q-DCA-1).

---

## Happy path

| # | Scenario | Dashboard key | Staging UUID |
|---|---|---|---|
| 1 | Full happy path — Consent → PAN → Business Category → Business Details (GST+Udyam verified) → Aadhaar/Digio → Verify → VKYC approved → Decision approved → Current Account created | `dca_happy_path` | |

---

## Fraud & dedupe blocks

| # | Scenario | Dashboard key | Staging UUID |
|---|---|---|---|
| 2 | `USER_BLACKLISTED` — hard fraud block at PAN Screen | `dca_fraud_blacklist` | |
| 3 | PAN dedupe — `PAN_DEDUPE_EXISTS_WITH_DIFFERENT_UUID`, existing account under a different uuid | `dca_pan_dedupe` | |

---

## Business verification (GST / Udyam)

| # | Scenario | Dashboard key | Staging UUID |
|---|---|---|---|
| 4 | GST not verified (non-gating today), Udyam present — progresses normally past Business Details | `dca_gst_not_verified` | |
| 5 | Udyam not verified — **mandatory block**, Business Details cannot pass | `dca_udyam_not_verified` | |

---

## VKYC

| # | Scenario | Dashboard key | Staging UUID |
|---|---|---|---|
| 6 | VKYC rejected — reason (`FACE_MISMATCH`) visible via `vkyc_details` (`product_flow=15`) | `dca_vkyc_rejected` | |
| 7 | VKYC pending — no update since scheduling | `dca_vkyc_pending` | |

---

## Audit & decision

| # | Scenario | Dashboard key | Staging UUID |
|---|---|---|---|
| 8 | Audit review declined — `CONCURRENT_AUDIT_REVIEW_DECLINED`, post-VKYC-approval | `dca_audit_declined` | |
| 9 | Rejected with **no matching redflag row at all** — "other" bucket, flag for investigation | `dca_other_rejected` | |

---

## Account creation (P0)

| # | Scenario | Dashboard key | Staging UUID |
|---|---|---|---|
| 10 | KYC approved, `CURRENT_ACCOUNT_CREATED` property never set in `user_states` — the DCA analogue of the source tool's largest bucket (`cif`-null) | `dca_account_not_created` | |

---

## Coverage — reset & out-of-scope

| # | Scenario | Dashboard key | Staging UUID |
|---|---|---|---|
| 11 | Apparent step-level redo at PAN Screen — rendered **only** with an explicit "(assumed — unconfirmed for DCA)" gate; DCA reset behaviour is an open question (PRD §9 / Q-DCA-4), this is NOT a confirmed reset flow | `dca_reset_assumed` | |
| 12 | `ONBOARDING_PLATFORM_SYNC` present — the application is EDI, not DCA. Dashboard must show the explicit out-of-scope message and **never** render DCA milestones over it | `dca_edi_out_of_scope` | |

---

## Dev-reference pages — additional edge-case coverage

The four `*-states.html` pages exercise more granular edge cases per card than the 12 top-level test users above, using the same shared `render.js` renderers (so there is no drift between what these pages show and what the live prototype can render):

- **`checks-states.html`** — every outcome for all 5 Checks rows (Fraud/redflag, GST, Udyam, VKYC, Audit review), plus an explicit callout of the rows deliberately not built (AML, Bureau stop, Risk decisioning, SIM binding — no confirmed DCA source, Q-DCA-6).
- **`alerts-states.html`** — the full P0/P1/info rule catalog, CLEAR vs checks-incomplete, the EDI-guard empty state, and the assumed-reset info alert.
- **`event-delivery-states.html`** — Received/Not received/Pending per event, with the snapshot-vs-event-log caveat reproduced on every cell.
- **`journey-states.html`** — all 10 canonical milestones, including the empty-hash GST/Udyam gotcha, the cross-product dedupe variants, the VKYC/redflag double-count guard, and the audit-review outcome states.

---

## Known coverage gaps (not built — see PRD §13 for why)

These scenario types exist in the DSA+CC/CC-only tool's test suite but have **no DCA equivalent here**, because the underlying data/behaviour is unconfirmed rather than merely unbuilt:

- **Per-milestone real timestamps for every step** — most DCA milestones show "—" by design (PRD §0.1/J-5); there is no event-log source to generate richer timestamped test cases from (Q-DCA-2).
- **A confirmed full-journey reset** (new application_id, old flips to a RESET-equivalent state) — DCA's reset mechanism, if any, is unconfirmed (Q-DCA-4); case #11 above is deliberately the weakest, most caveated version of this rather than a confident reset test case.
- **AML / Bureau stop / Risk decisioning / SIM binding scenarios** — omitted entirely, not just untested (Q-DCA-6).
- **Systemic/batch-issue banner** — no DCA-specific aggregate-query source was given; not built (mirrors the source PRD's own Q4/§10.2 gap, now doubly open for this channel).
- **Real escalation-volume-weighted prioritisation of which cases matter most** — this list is ordered by taxonomy coverage, not by measured frequency (Q-DCA-1).
