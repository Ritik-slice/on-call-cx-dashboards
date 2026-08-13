# Design Spec — CX / Ops Onboarding Dashboard (DCA)

| | |
|---|---|
| **Companion to** | `PRD_ops_dashboard_dca.md` (product) · `index.html` (prototype) |
| **Companion product's design spec** | `design_spec_ops_dashboard.md` (DSA+CC / CC-only) — this document reuses that one's visual system verbatim; read it first if you haven't. |
| **Dev-reference pages** | `journey-states.html` · `alerts-states.html` · `checks-states.html` · `event-delivery-states.html` — same pattern as the DSA+CC tool: separate pages under the top-bar "Dev references ▾" dropdown, all loading the shared `styles.css` + `render.js` (single source of truth, no drift). |
| **Purpose** | Define the design for the DCA-channel sibling tool: same visual system, same IA family, retargeted to DCA's data shape and funnel. |
| **Status** | v0.1 — concept adaptation, not yet validated with a real CX agent |
| **Design intent** | **No new visual language.** This is one internal design system serving two on-call tools for two onboarding channels. Reuse the DSA+CC tool's theme, tokens, and component patterns exactly; the only thing that changes is what data flows through them. |

---

## 1. Design goal

Identical to the DSA+CC tool's goal, restated for this channel: a CX agent, mid-call about a stuck current-account merchant, must go from a `uuid` to "where are they, why are they stuck, who owns it" in seconds. Same funnel-first design job, same shallowest-depth-the-ticket-allows principle.

## 2. Design principles

Unchanged from the DSA+CC tool (design_spec §2, points 1–5 apply verbatim: funnel not dump, theme borrowed/structure owned, glance-first, read-only and honest, nothing cropped). One addition specific to this channel:

6. **Show the data-shape gap, don't hide it.** DCA's source is a snapshot, not an event log (PRD §0.1). Where the DSA+CC tool can show a confident per-milestone timestamp, this tool sometimes can only show "—". The design must make that distinction *legible*, not paper over it with a derived-looking timestamp the source doesn't back up.

---

## 3. What changed from the DSA+CC tool, and why

This is **not** "what changed from Spacce" (that framing belongs to the DSA+CC tool's own history, §3 there, already resolved). This is what changed **retargeting that same tool to DCA**:

| Removed / changed | Why |
|---|---|
| **Application switcher demoted from expected-common to defensive-only** | DCA is (as far as current schema knowledge goes) one `uuid` → one application, not one `uuid` → many (DSA+CC/CC-only). The switcher UI still exists (Q-DCA-10 leaves the door open) but is not the default visual weight it was for the source tool. |
| **Bureau stop / Risk decisioning / AML / SIM binding rows dropped from Checks** | No DCA-specific source was confirmed for any of these (PRD §7.3, Q-DCA-6). Rather than reuse the DSA+CC tool's rows against unconfirmed data, the Checks card is narrower and honest about it. |
| **GST verification + Udyam verification rows added to Checks** | New to this channel — DCA's business-verification gate has no DSA+CC analogue. Two rows, not one, because the policy asymmetry (Udyam mandatory, GST optional) is itself the thing agents most need surfaced correctly. |
| **"Full event log" panel replaced with an explicit absence note** | The DSA+CC tool's J-10 (raw chronological action log) has nothing to back it for DCA — there is no event log. Showing an empty or fake panel would be worse than saying so. |
| **Milestone timestamps: mostly "—"** | Only VKYC, audit-adjacent `updated_at`, and the account-creation property genuinely carry a timestamp for DCA. The DSA+CC tool's `deriveTs()` convenience (interpolating a plausible time from a base) is **not** reused for milestones that have no real timestamp backing — see §6. |
| **New cross-cutting guard: EDI-vs-DCA out-of-scope state** | DCA and EDI share a flag taxonomy closely enough that a naive render could show EDI data as if it were DCA. This is a new empty/guard state not present in the DSA+CC tool (which has no sibling flow this close). |
| **Reset banner gated behind an "(assumed)" marker** | DCA's reset behaviour is unconfirmed (PRD §9). If shown at all in the prototype, it's visually flagged as unconfirmed rather than presented with the DSA+CC tool's confident "Slack-verified" framing. |

---

## 4. Layout

Same shell as the DSA+CC tool: top bar → user header → (application switcher, now secondary) → 2-column funnel body (left glance-stack: Alerts → Checks → Event delivery; right: journey timeline). Collapses to 1 column below 1080px.

No new layout primitives were needed — the funnel IA transfers directly; only the *card contents* differ.

## 5. Visual system

**Identical to the DSA+CC tool — same tokens, unchanged.** This is one shared internal design system, not a rebrand:

| Token | Value | Use |
|---|---|---|
| Primary | Purple `#6D28D9` (`#7C3AED` lighter) | Brand, timeline nodes, active states, accents |
| Purple tints | `#F5F3FF`, `#EDE9FE`, line `#E5E1F5` | Backgrounds, node rings, connectors |
| Surface / bg | `#FFFFFF` / `#F6F6FA` | Cards / page |
| Border | `#ECECF2` | Card & row separators |
| Text / muted | `#1F2333` / `#7A8194` | Body / secondary |
| Success | `#15803D` on `#E9F9EF` | Completed / Clear / Verified / Received / Active |
| Danger | `#DC2626` on `#FDECEC` | Stuck / Blocked / Hard block / Not received / Rejected |
| Warn | `#B45309` on `#FEF6E7` | Warning / Not-verified-non-gating / caveat states |
| Info | `#2563EB` on `#ECF1FE` | Neutral info, out-of-scope routing |

No new colors were introduced. The GST/Udyam "mandatory vs non-gating" distinction is carried entirely through **copy and badge choice** (Udyam-not-verified uses the danger/warn treatment appropriate to a real block; GST-not-verified uses the info/warn treatment appropriate to a non-blocking note) — not through a new color, so the palette stays exactly as validated in the source tool.

## 6. Component specs

- **User header** — unchanged pattern: avatar, name, copyable `uuid`, phone/email, status pill + one-line summary + "as of &lt;time&gt; · ⟳ Refresh". New: an **EDI-routing guard state** — when the looked-up application is `ONBOARDING_PLATFORM_SYNC`, the header renders the out-of-scope message instead of a status pill (mirrors the existing "no in-scope applications" empty state pattern, new trigger condition).
- **Application switcher** — same pill component; expected to render 0–1 tabs for most DCA lookups rather than the DSA+CC tool's typical 2 (mirrors PRD §7.0's "not a primary UI element" framing). No visual change to the component itself.
- **Alerts** — same derived/ranked/P0-P1-info pattern; DCA-specific rule catalog (PRD §7.2.4) swapped in. New alert content, same component.
- **Checks** — same row component (outcome + reason + time, wraps). Rows: **Fraud/redflag · GST verification · Udyam verification · VKYC · Audit review.** Dropped relative to the DSA+CC tool: AML, Bureau stop, Risk decisioning, SIM binding (no confirmed DCA source — see §3 above). The GST and Udyam rows sit adjacent, in that order, so the mandatory/optional asymmetry reads left-to-right as "the one that doesn't block, then the one that does."
- **Event delivery** — same row component, **plus a new small-print caveat line in the card header**: "as of last fetch — DCA has no confirmed event log; 'Received' means the flag/property was present in this fetch, not that we observed a delivery event." This is new relative to the DSA+CC tool and is not optional (PRD E-5) — it's the single most important piece of copy in the whole retargeted card.
- **Timeline** — same icon-node component. Timestamp shown only where a milestone has a genuinely timestamped backing table; all others show "—" rather than a derived time (this is a **behavioural** change to how the shared timeline engine is called for this tool, not a new component — `render.js`'s milestone renderer is unchanged, this tool simply doesn't pass a fabricated `ts` the way the DSA+CC prototype's `deriveTs()` convenience does for every completed step).
- **GST/Udyam attribute marker** — new small component, same visual family as the DSA+CC tool's CKYC-validity marker (`.ckyc-line` → generalized to a small badge-line under the Business Details milestone): a `Verified`/`Not verified` badge per attribute, using the same visual grammar as the existing dedupe-attribute line.
- **EDI-out-of-scope card** — new empty-state variant, visually identical to the existing "no in-scope applications" empty state (`.sp-noscope`), different copy: "This application is EDI, not DCA — see the EDI on-call tool."
- **Reset banner (assumed)** — if rendered at all, carries a visible `(assumed — unconfirmed for DCA)` suffix in the banner label itself, not just in a tooltip or doc — an agent glancing at the screen must see the caveat without hovering anything.

---

## 7. Design gaps

| # | Gap | Direction |
|---|---|---|
| G1 | **Real iconography** — inherits the DSA+CC tool's open item (D1 there); still emoji placeholders. | Same open backlog item, shared across both tools — solve once, applies to both. |
| G2 | **GST/Udyam badge legibility at a glance** — two adjacent Checks rows with an asymmetric policy (one mandatory, one not) risk agents skimming past the distinction. | Validate with a real agent whether the copy alone ("mandatory block" vs "non-gating") is enough, or whether a visual weight difference is needed. |
| G3 | **"—" timestamp fatigue** — most DCA milestones will show "—" for time (§6). Untested whether this reads as "the tool is broken" rather than "the source genuinely doesn't have this." | Needs a short explanatory microcopy pass and/or a one-time onboarding tooltip for agents, validated in pilot. |
| G4 | **EDI-guard false positives** — if `ONBOARDING_PLATFORM_SYNC` detection has any edge case (e.g. a DCA app that also carries that flag for an unrelated reason), the guard could hide a legitimate DCA lookup entirely. | Needs Eng confirmation the flag is a clean, exclusive signal (ties to PRD Q-DCA-2 area — same general "confirm the flag taxonomy" concern). |
| G5 | **Application-switcher visual weight** — demoted per §3, but not yet re-tested at reduced weight; may look like a bug (missing tabs) rather than an intentional 1-app-per-merchant design. | Validate with a real agent; consider a persistent "1 application on record" micro-label even when the switcher itself is hidden. |

---

## 8. Open design decisions

1. **Should the Event-delivery caveat live in the card header (current default) or as a one-time dismissible tooltip?** Header keeps it always-visible (never missed) but adds visual weight to every lookup.
2. **Should "—" timestamps be styled differently from "the source has this but it's empty"** (i.e. a genuine "—" vs "not applicable" vs "unknown") — currently all render the same dash; may need three distinct treatments.
3. **Reset banner** — build now with the "(assumed)" gate (current default, keeps visual parity with the DSA+CC tool for this same-family product), or omit entirely until Q-DCA-4 resolves? Current default risks agents trusting a banner that may not reflect real DCA behaviour even with the caveat attached.
4. **Application switcher** — keep the defensive multi-tab UI (current default, in case Q-DCA-10 resolves "yes"), or strip it down to a single-application layout and add the switcher back only if/when confirmed needed?

---

## 9. Definition of done (design)

- Visual system reused with zero new tokens (done — §5).
- GST/Udyam Checks rows + Business Details attribute marker specified (done — §6).
- Event-delivery snapshot-vs-event caveat specified and non-optional (done — §6, PRD E-5).
- EDI-out-of-scope guard state specified (done — §6).
- Real iconography (G1) — *open, shared backlog with the DSA+CC tool.*
- "—" timestamp legibility (G3) and reset-banner gating (G3/ODD-3) — *open, needs pilot validation.*
- Validated with ≥1 real CX agent on the DCA queue specifically (not just carried over from the DSA+CC tool's own validation, since the GST/Udyam and snapshot-caveat content is new).

---

*v0.1 — design adaptation for the DCA channel. Visual system is shared and unchanged from `design_spec_ops_dashboard.md`; everything in this document is about what data now flows through those same components, and the handful of new guard/caveat states that data shape requires.*
