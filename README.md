# On-Call CX Dashboards — DCA & EDI

Internal CX operations dashboards for on-call support teams at Slice. Built as static HTML/JS/CSS — no build step, no dependencies.

## Dashboards

### DCA (Direct Current Account)
`dca/index.html` — 13-milestone merchant onboarding journey for direct current account applications.

**Flow:** TnC → PAN → Business Details → Business Address → CKYC/Aadhaar → Udyam → GST → Verify Details → Fraud Check (pre-VKYC) → VKYC → Post-VKYC Checks → Decision → CA Creation

### EDI (Merchant Lending)
`edi/index.html` — 16-milestone merchant lending / business loan journey.

**Flow:** TnC → Permissions → Loan Requirement → PAN → Credit Score → Account Aggregator → CKYC/Aadhaar → Business Details → Business Address → Udyam → Verify Details → VKYC → Post-VKYC Outcome → Sanction Screen → GST/CPV → Loan Disbursement

## Running Locally

Each dashboard is a self-contained HTML file. Open directly in a browser or serve with any static server:

```bash
# DCA on port 8743
python3 -m http.server 8743 --directory dca

# EDI on port 8744
python3 -m http.server 8744 --directory edi
```

## Features

- **Real-time lookup**: Enter a merchant UUID or phone number to load their journey state
- **QA test panel**: 14 built-in test cases per dashboard covering happy paths, edge cases, and error states
- **Alerts engine**: Auto-derived P0/P1/info alerts based on application state
- **Checks card**: System check status (Fraud, VKYC, Audit, GST, Udyam, etc.)
- **Event delivery tracker**: Notification/communication delivery status
- **Journey timeline**: Visual milestone tracker with step-specific detail rendering

## Data Source

Both dashboards query `slice_x_application_base` (current-state snapshot) via the onboarding gold layer. DCA is identified by `updated_by = 'onboarding-svc'` without the `ONBOARDING_PLATFORM_SYNC` flag. EDI is identified by `updated_by = 'onboarding_v2'`.

## Design System

Purple accent (#6D28D9), Spacce visual tokens. Responsive layout with collapsible QA sidebar.
