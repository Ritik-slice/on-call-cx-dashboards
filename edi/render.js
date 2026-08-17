// render.js -- shared timeline engine for the EDI on-call dashboard.
// Adapted from the DCA on-call dashboard's render.js: same architecture (shared engine,
// loaded by index.html, single source of truth, no drift), same visual grammar
// (styles.css tokens unchanged). What's different is the milestone skeleton (EDI's
// 16-stage merchant-lending funnel, not DCA's 10-step flags-derived one) and the
// Checks-card renderers (Fraud/redflag, GST, Udyam, VKYC, Audit, Risk Decision,
// Credit Score, Account Aggregator).
//
// HONESTY RULE: same as DCA -- no fake timestamps. A step renders "--" unless the
// test-user data supplies a real `ts`.

// -- helper: EDI milestone names (16 steps) --
const EDI_MILESTONES = [
  "Terms & Condition",
  "Permissions",
  "Loan Requirement",
  "PAN Screen",
  "Credit Score",
  "Account Aggregator (Ignoosis)",
  "CKYC / Aadhaar",
  "Business Details",
  "Business Address",
  "Udyam Registration",
  "Verify Details",
  "VKYC",
  "Post-VKYC Outcome",
  "Sanction Screen",
  "GST / CPV",
  "Loan Disbursement"
];

function mkEdiSteps(currentStep, overrides) {
  overrides = overrides || {};
  return EDI_MILESTONES.map((name, idx) => {
    const n = idx + 1;
    const num = String(n).padStart(2, "0");
    const status = n < currentStep ? "done" : n === currentStep ? "stuck" : "pending";
    const detail = n < currentStep ? "Reached (a later step is present)" : n === currentStep ? "Last step reached -- current position" : "Not reached";
    return Object.assign({ num, name, status, detail, fields: [] }, overrides[num] || {});
  });
}

function toggleStepDetail(i) { const d = document.getElementById("stepd-" + i); if (d) d.style.display = d.style.display === "none" ? "block" : "none"; }

function renderField(f) {
  if (typeof f === "string") return `<span class="field-pill">${f}</span>`;
  const cls = f.bad ? "bad" : f.warn ? "warn" : f.ok ? "ok" : "";
  return `<span class="field-pill ${cls}">${f.v}</span>`;
}

function stepIcon(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("terms") || n.includes("condition") || n.includes("tnc")) return "\u{1F4DD}";        // Terms & Condition
  if (n.includes("permission")) return "\u{1F511}";                                                     // Permissions
  if (n.includes("loan requirement")) return "\u{1F4B0}";                                              // Loan Requirement
  if (n.includes("pan")) return "\u{1FAAA}";                                                            // PAN Screen
  if (n.includes("credit score")) return "\u{1F4CA}";                                                   // Credit Score
  if (n.includes("account aggregator") || n.includes("ignoosis")) return "\u{1F3E6}";                  // Account Aggregator
  if (n.includes("ckyc") || n.includes("aadhaar")) return "\u{1F510}";                                 // CKYC / Aadhaar
  if (n.includes("business details")) return "\u{1F3E2}";                                              // Business Details
  if (n.includes("business address")) return "\u{1F4CD}";                                              // Business Address
  if (n.includes("udyam")) return "\u{1F4CB}";                                                         // Udyam Registration
  if (n.includes("verify details")) return "✅";                                                    // Verify Details
  if (n.includes("vkyc") && !n.includes("post")) return "\u{1F3A5}";                                   // VKYC
  if (n.includes("post-vkyc") || n.includes("outcome")) return "\u{1F50D}";                            // Post-VKYC Outcome
  if (n.includes("sanction")) return "\u{1F4B3}";                                                       // Sanction Screen
  if (n.includes("gst") || n.includes("cpv")) return "\u{1F4C4}";                                      // GST / CPV
  if (n.includes("disbursement")) return "\u{1F4B8}";                                                   // Loan Disbursement
  return "●";
}

function stepBadge(status) {
  const map = {
    done:    ["b-done",   "Reached"],
    stuck:   ["b-stuck",  "Stuck"],
    warn:    ["b-warn",   "Warning"],
    pending: ["b-pending","Pending"],
    skip:    ["b-skip",   "Skipped"],
    reset:   ["b-reset",  "↺ Reset"],
  };
  return map[status] || ["b-pending", status];
}
function nodeClass(status) {
  if (status === "stuck") return "stuck";
  if (status === "pending" || status === "skip") return "muted";
  return "";
}

// -- EDI-specific step sub-renderers --

// Loan requirement range display
function renderLoanRange(step) {
  if (!step.loanRange) return "";
  return `<div class="loan-range-pill">${step.loanRange}${step.loanPurpose ? " -- " + step.loanPurpose : ""}</div>`;
}

// Credit score display
function renderCreditScore(step) {
  if (!step.creditScore) return "";
  return `<div class="credit-score-card">
    <div class="credit-score-label">Credit Score (post-PAN)</div>
    <div class="credit-score-value">${step.creditScore}</div>
  </div>`;
}

// Account Aggregator bank list
function renderAABanks(step) {
  if (!step.aaBanks) return "";
  const rows = step.aaBanks.map(b => {
    const cls = b.status === "linked" ? "aa-bank-ok" : b.status === "failed" ? "aa-bank-fail" : "aa-bank-pending";
    const label = b.status === "linked" ? "Linked" : b.status === "failed" ? "OTP Failed" : "Pending";
    return `<div class="aa-bank-row"><span class="aa-bank-name">${b.name}</span><span class="aa-bank-status ${cls}">${label}</span></div>`;
  }).join("");
  return `<div class="aa-bank-list">${rows}</div>`;
}

// Non-individual PAN block
function renderNonIndividualBlock(step) {
  if (!step.nonIndividualBlock) return "";
  return `<div class="block-banner bb-hard">
    <div>
      <span class="bb-label">Non-individual PAN -- inline validation error</span>
      PAN type detected: <strong>${step.nonIndividualBlock.panType}</strong>. "We currently accept only sole proprietorship or individual PANs. Please enter a valid individual/sole-prop PAN to continue." There is no separate business-PAN entry flow -- this is the only PAN type EDI accepts.
      ${step.nonIndividualBlock.ts ? `<br><span style="font-size:11px;opacity:.8;">${step.nonIndividualBlock.ts}</span>` : ""}
    </div>
  </div>`;
}

// Sanction card
function renderSanctionCard(step) {
  if (!step.sanction) return "";
  return `<div class="sanction-card">
    <div class="sanction-card-label">Approved Loan Limit</div>
    <div class="sanction-card-amount">${step.sanction.amount}</div>
    <div class="sanction-card-detail">${step.sanction.detail || "User can continue to disburse"}</div>
  </div>`;
}

// Waitlist card
function renderWaitlistCard(step) {
  if (!step.waitlist) return "";
  const items = (step.waitlist.actionItems || []).map(i => `<li>${i}</li>`).join("");
  return `<div class="waitlist-card">
    <div class="waitlist-card-label">Waitlisted</div>
    <div class="waitlist-card-score">Risk score: ${step.waitlist.score}/100</div>
    ${items ? `<div class="waitlist-card-items"><strong>Actionable items:</strong><ul>${items}</ul></div>` : ""}
  </div>`;
}

// Post-VKYC outcome card (3 cases)
function renderPostVkycOutcome(step) {
  if (!step.postVkycOutcome) return "";
  const o = step.postVkycOutcome;
  if (o.case === "rejected") {
    return `<div class="outcome-card oc-rejected">
      <div class="outcome-card-label">Post-VKYC Outcome -- Case 1</div>
      <div class="outcome-card-action">✗ KYC Declined -- Application Rejected</div>
      ${o.reason ? `<div class="agent-row"><strong>Reason:</strong> ${o.reason}</div>` : ""}
      ${o.ts ? `<div class="agent-row"><strong>Time:</strong> ${o.ts}</div>` : ""}
    </div>`;
  }
  if (o.case === "approved") {
    return `<div class="outcome-card oc-approved">
      <div class="outcome-card-label">Post-VKYC Outcome -- Case 2</div>
      <div class="outcome-card-action">✓ VKYC Verified -- Proceed to Sanction</div>
      <div class="agent-row">Risk: <strong>Approved</strong> | KYC: <strong>Approved</strong> | Audit: <strong>Approved</strong> | Fraud: <strong>Clear</strong></div>
      ${o.ts ? `<div class="agent-row"><strong>Time:</strong> ${o.ts}</div>` : ""}
    </div>`;
  }
  if (o.case === "waitlisted") {
    return `<div class="outcome-card oc-waitlisted">
      <div class="outcome-card-label">Post-VKYC Outcome -- Case 3</div>
      <div class="outcome-card-action">⚠ Risk Rejected + VKYC Verified -- Waitlisted</div>
      ${o.score ? `<div class="agent-row"><strong>Risk score:</strong> ${o.score}/100</div>` : ""}
      ${o.ts ? `<div class="agent-row"><strong>Time:</strong> ${o.ts}</div>` : ""}
    </div>`;
  }
  return "";
}

// GST/CPV conditional display
function renderGstCpvDetail(step) {
  if (!step.gstCpv) return "";
  const g = step.gstCpv;
  if (g.skipped) {
    return `<div class="block-banner bb-info">
      <div>
        <span class="bb-label">GST skipped via CPV</span>
        User is in a CPV-serviceable region. GST verification is skippable.
      </div>
    </div>`;
  }
  if (g.mandatory) {
    return `<div class="block-banner bb-soft">
      <div>
        <span class="bb-label">GST mandatory -- not in CPV region</span>
        User is NOT in a CPV-serviceable region. GST verification is mandatory before disbursement.
        ${g.gstStatus ? `<br>GST status: <strong>${g.gstStatus}</strong>` : ""}
      </div>
    </div>`;
  }
  if (g.verifiedBeforeVkyc) {
    return `<div class="block-banner bb-info">
      <div>
        <span class="bb-label">GST verified before VKYC</span>
        GST was verified before VKYC + demos verified. This step is skipped -- proceed to disbursement.
      </div>
    </div>`;
  }
  return "";
}

// Disbursement card
function renderDisbursementCard(step) {
  if (!step.disbursement) return "";
  const d = step.disbursement;
  if (d.status === "disbursed") {
    return `<div class="sanction-card">
      <div class="sanction-card-label">Loan Disbursed</div>
      <div class="sanction-card-amount">${d.amount}</div>
      <div class="sanction-card-detail">${d.detail || "Disbursed to account successfully"}</div>
    </div>`;
  }
  if (d.status === "waitlisted") {
    const items = (d.actionItems || []).map(i => `<li>${i}</li>`).join("");
    return `<div class="waitlist-card">
      <div class="waitlist-card-label">Waitlisted -- Loan Not Disbursed</div>
      <div class="waitlist-card-score">Risk score: ${d.score}/100</div>
      ${items ? `<div class="waitlist-card-items"><strong>Actionable items:</strong><ul>${items}</ul></div>` : ""}
    </div>`;
  }
  return "";
}

// -- DSA-ported helpers (dedupe, ckyc, timestamp derivation) --

function effectiveDedupe(step) {
  if (step.dedupe) return step.dedupe;
  const n = (step.name || "").toLowerCase();
  const isPan = n.includes("pan");
  const isVkyc = n.includes("vkyc") && !n.includes("post");
  if (!(isPan || isVkyc)) return null;
  if (step.dedupeBlock && step.dedupeBlock.blocked) return { status: "conflict", matchedUUIDs: [step.dedupeBlock.duplicateUUID] };
  if (step.status === "done" || step.status === "skip") return { status: "clear" };
  return null;
}

function effectiveCkyc(step) {
  const n = (step.name || "").toLowerCase();
  if (!n.includes("ckyc") || n.includes("score")) return null;
  if (step.ckycValidity) return step.ckycValidity;
  if (step.status === "done") return "valid";
  return null;
}
function renderCkycMarker(v) {
  if (!v) return "";
  const valid = v === "valid";
  const cls = valid ? "b-done" : "b-warn";
  const label = valid ? "CKYC record -- Valid" : "CKYC record -- Invalid -> Aadhaar fallback";
  return '<div class="ckyc-line"><span class="tl-badge ' + cls + '">' + label + '</span></div>';
}

function deriveTs(base, i) {
  const d = new Date(String(base || "2026-08-01 10:00").replace(" ", "T"));
  if (isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() + i * 4);
  const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

function renderDedupe(d, ts, where) {
  if (!d) return "";
  const clear = d.status === "clear";
  const cls = clear ? "b-done" : "b-stuck";
  const label = clear ? "Dedupe -- Clear" : "Dedupe -- Conflict";
  const line = '<div class="dedupe-line"><span class="tl-badge ' + cls + '">' + label + '</span>' + (ts ? '<span class="tl-ts" style="margin-left:auto;">' + ts + '</span>' : "") + '</div>';
  if (clear) return line;
  let lines = Array.isArray(d.lines) && d.lines.length ? d.lines.slice() : [];
  if (!lines.length) {
    if (d.matchedOn) lines.push('<span class="k">Matched on:</span> ' + (Array.isArray(d.matchedOn) ? d.matchedOn.join(", ") : d.matchedOn));
    (d.candidates || []).forEach((c, i) => lines.push(
      '<span class="k">Candidate ' + (i + 1) + ':</span> ' + (c.uuid || "--") +
      (c.cif ? " -- CIF " + c.cif : "") + (c.status ? " -- " + c.status : "") + (c.name ? " -- " + c.name : "")));
    if (!(d.candidates || []).length) {
      (d.matchedUUIDs || []).forEach(u => lines.push('<span class="k">Existing user:</span> ' + u));
      (d.matchedCIFs || []).forEach(c => lines.push('<span class="k">Existing CIF:</span> ' + c));
    }
    if (d.rule) lines.push('<span class="k">Rule:</span> ' + d.rule);
    if (d.decision) lines.push('<span class="k">Decision:</span> ' + d.decision);
  }
  const whereLabel = d.where || where || "";
  const panel = '<div class="dedupe-panel">' +
    (whereLabel ? '<div class="dedupe-panel-where">Matched at: ' + whereLabel + '</div>' : "") +
    lines.map(l => '<div class="dedupe-panel-line">' + l + '</div>').join("") +
    '</div>';
  return line + panel;
}

function renderStep(step, isLast, i, appBase) {
  const resolvedTs = step.ts || "";
  const [badgeCls, badgeLabel] = stepBadge(step.status);
  const tsLabel = resolvedTs;

  // Reused step -- short-circuit
  if (step.reused) {
    return '<div class="tl-item"><div class="tl-node muted">\u{1F4C4}</div><div class="tl-body">' +
      '<div class="tl-title">' + step.name + (resolvedTs ? '<span class="tl-ts">' + resolvedTs + '</span>' : "") + '</div>' +
      '<div class="tl-desc">' + step.detail + '</div>' +
      '<span class="tl-badge b-reused">Reused from ' + step.reusedFrom + '</span></div></div>';
  }

  let extra = "";

  // Non-individual PAN block
  extra += renderNonIndividualBlock(step);

  // Fraud block at verify details (soft or hard)
  if (step.fraudBlock && step.fraudBlock.blocked) {
    const fb = step.fraudBlock;
    const cls = fb.blockType === "HARD" ? "bb-hard" : "bb-soft";
    const label = fb.blockType === "HARD" ? "Fraud hard block" : "Fraud soft block";
    extra += '<div class="block-banner ' + cls + '">' +
      '<div>' +
      '<span class="bb-label">' + label + ' -- triggered at ' + (fb.trigger || "verify_details").replace(/_/g, " ") + '</span>' +
      'Reason: <strong>' + fb.reason + '</strong>' + ((fb.timestamp || resolvedTs) ? ' &nbsp;&middot;&nbsp; ' + (fb.timestamp || resolvedTs) : "") +
      '<br><span style="font-size:11px;opacity:.8;">Owner: Fraud squad -- CX cannot unblock</span>' +
      '</div></div>';
  }

  // Dedupe block (legacy banner -- kept for backward compat)
  if (step.dedupeBlock && step.dedupeBlock.blocked) {
    const db = step.dedupeBlock;
    extra += `<div class="block-banner bb-hard">
      <div>
        <span class="bb-label">Dedupe block -- ${db.reasonLabel || "redflag match"}</span>
        Existing account: <strong style="word-break:break-all;">${db.duplicateUUID}</strong> &nbsp;&middot;&nbsp; Status: <strong>${db.duplicateStatus}</strong>
        ${(db.timestamp || resolvedTs) ? ` &nbsp;&middot;&nbsp; ${db.timestamp || resolvedTs}` : ""}
        <br><span style="font-size:11px;opacity:.8;">Owner: UID team -- CX cannot unblock</span>
      </div>
    </div>`;
  }

  // Loan requirement range
  extra += renderLoanRange(step);

  // Credit score
  extra += renderCreditScore(step);

  // AA bank list
  extra += renderAABanks(step);

  // VKYC outcome (same as DCA)
  if (step.vkycOutcome) {
    const vo = step.vkycOutcome;
    const voTs = vo.ts || resolvedTs;
    const tsRow = voTs ? `<div class="agent-row"><strong>Time:</strong> ${voTs}</div>` : "";
    if (vo.status === "APPROVED") {
      extra += `<div class="agent-card ac-accept">
        <div class="agent-card-label">VKYC</div>
        <div class="agent-card-action">✓ Approved</div>
        ${tsRow}
      </div>`;
    } else if (vo.status === "REJECTED") {
      extra += `<div class="agent-card ac-reject">
        <div class="agent-card-label">VKYC</div>
        <div class="agent-card-action">✗ Rejected</div>
        ${vo.rejectionReason ? `<div class="agent-row"><strong>Rejection reason:</strong> ${vo.rejectionReason}</div>` : ""}
        ${tsRow}
      </div>`;
    } else if (vo.status === "PENDING") {
      extra += `<div class="agent-card ac-end">
        <div class="agent-card-label">VKYC</div>
        <div class="agent-card-action">Pending</div>
        ${tsRow}
      </div>`;
    }
  }

  // VKYC agent action
  if (step.vkycAgent) {
    const va = step.vkycAgent;
    const vaTs = va.ts || resolvedTs;
    const tsRow = vaTs ? '<div class="agent-row"><strong>Time:</strong> ' + vaTs + '</div>' : "";
    if (va.action === "ACCEPTED") {
      extra += '<div class="agent-card ac-accept"><div class="agent-card-label">VKYC Agent Action</div><div class="agent-card-action">✓ Accepted</div>' + tsRow + '</div>';
    } else if (va.action === "END_CALL") {
      extra += '<div class="agent-card ac-end"><div class="agent-card-label">VKYC Agent Action</div><div class="agent-card-action">Call ended by agent</div>' +
        (va.reason ? '<div class="agent-row"><strong>Reason:</strong> ' + va.reason + '</div>' : "") + tsRow + '</div>';
    } else if (va.action === "REJECTED") {
      const typeLabel = va.rejectType === "HARD" ? "Hard reject" : "Soft reject";
      extra += '<div class="agent-card ac-reject"><div class="agent-card-label">VKYC Agent Action</div><div class="agent-card-action">✗ ' + typeLabel + '</div>' +
        (va.reason ? '<div class="agent-row"><strong>Reason:</strong> ' + va.reason + '</div>' : "") +
        '<div class="agent-row"><strong>Confirmation:</strong> ' + (va.confirmationDone ? "✓ Confirmed" : "⚠ Awaiting confirmation") + '</div>' + tsRow + '</div>';
    }
  }

  // Post-VKYC outcome
  extra += renderPostVkycOutcome(step);

  // Post-VKYC fraud block
  if (step.fraudBlockPost && step.fraudBlockPost.blocked) {
    const fb = step.fraudBlockPost;
    const cls = fb.blockType === "HARD" ? "bb-hard" : "bb-soft";
    extra += '<div class="block-banner ' + cls + '">' +
      '<div><span class="bb-label">Post-VKYC fraud block (' + (fb.blockType || "HARD") + ')</span>' +
      'Reason: <strong>' + fb.reason + '</strong>' + ((fb.timestamp || resolvedTs) ? ' &nbsp;&middot;&nbsp; ' + (fb.timestamp || resolvedTs) : "") +
      '<br><span style="font-size:11px;opacity:.8;">Owner: Fraud squad -- Review queues blocked until unblocked</span>' +
      '</div></div>';
  }

  // Audit review outcome
  if (step.auditOutcome) {
    const ao = step.auditOutcome;
    const outMap = {
      under_review: ["ro-pending", "Under review"],
      approved:     ["ro-accept",  "✓ Approved (post-audit)"],
      declined:     ["ro-reject",  "✗ Declined -- CONCURRENT_AUDIT_REVIEW_DECLINED"],
    };
    const [cls, label] = outMap[ao.outcome] || ["ro-pending", ao.outcome];
    const aoTs = ao.ts || resolvedTs;
    extra += `<div class="review-outcome">
      <span class="ro-badge ${cls}">${label}</span>
      ${ao.note ? `<span class="ro-badge ro-pending" style="font-family:monospace;max-width:100%;word-break:break-word;white-space:normal;">${ao.note}</span>` : ""}
      ${aoTs ? `<span class="tl-ts" style="margin-left:auto;">${aoTs}</span>` : ""}
    </div>`;
  }

  // Review outcome (generic, from DSA)
  if (step.reviewOutcome) {
    const ro = step.reviewOutcome;
    const outMap = {
      accepted:      ["ro-accept",  "✓ Accepted"],
      rejected:      ["ro-reject",  "✗ Rejected"],
      mark_for_later:["ro-later",   "⌛ Marked for later"],
      app_start:     ["ro-appstart","→ app_start triggered"],
      pending:       ["ro-pending", "Awaiting decision"],
    };
    const [cls, label] = outMap[ro.outcome] || ["ro-pending", ro.outcome];
    const roTs = ro.ts || resolvedTs;
    extra += '<div class="review-outcome">' +
      '<span class="ro-badge ' + cls + '">' + label + '</span>' +
      (ro.reason ? '<span class="ro-badge ro-pending" style="font-family:monospace;max-width:100%;word-break:break-word;white-space:normal;">Reason: ' + ro.reason + '</span>' : "") +
      (roTs ? '<span class="tl-ts" style="margin-left:auto;">' + roTs + '</span>' : "") +
      '</div>';
  }

  // Post-VKYC pipeline (Risk -> Fraud -> Dedupe etc.)
  if (step.pipeline) {
    const clsMap = { pass:"pl-pass", blocked:"pl-blocked", pending:"pl-pending", warn:"pl-warn" };
    const nodes = step.pipeline.map((p, i) => {
      const badge = p.status === "pass" ? p.name + ": PASS"
                  : p.status === "blocked" ? p.name + ": BLOCKED" + (p.reason ? " (" + p.reason + ")" : "")
                  : p.name;
      return '<div class="pl-node">' +
        (i > 0 ? '<span class="pl-arrow">›</span>' : "") +
        '<span class="pl-badge ' + (clsMap[p.status] || "pl-pending") + '">' + badge + '</span>' +
        '</div>';
    }).join("");
    extra += '<div class="pipeline">' + nodes + (resolvedTs ? '<span class="tl-ts" style="margin-left:auto;">' + resolvedTs + '</span>' : "") + '</div>';
  }

  // Sanction card
  extra += renderSanctionCard(step);

  // GST/CPV detail
  extra += renderGstCpvDetail(step);

  // Disbursement card
  extra += renderDisbursementCard(step);

  // Waitlist card
  extra += renderWaitlistCard(step);

  // Derive dedupe and ckyc markers
  const dedupe = effectiveDedupe(step);
  const ckyc = effectiveCkyc(step);

  const detailRows = step.data ? Object.entries(step.data).map(([k, v]) => `<div class="tl-d-row"><span class="tl-d-k">${k}</span><span class="tl-d-v">${v}</span></div>`).join("") : "";
  const fields = (step.fields || []).filter(f => !/dedupe/i.test(typeof f === "string" ? f : (f.v || "")));
  return `
    <div class="tl-item">
      <div class="tl-node ${nodeClass(step.status)}">${stepIcon(step.name)}</div>
      <div class="tl-body">
        <div class="tl-title">${step.name}${tsLabel ? `<span class="tl-ts">${tsLabel}</span>` : `<span class="tl-ts" style="opacity:.55;">—</span>`}</div>
        <div class="tl-desc">${step.detail}</div>
        ${fields.length ? `<div class="step-fields">${fields.map(renderField).join("")}</div>` : ""}
        ${ckyc ? renderCkycMarker(ckyc) : ""}
        ${dedupe ? renderDedupe(dedupe, resolvedTs, step.name) : ""}
        <div class="tl-badge-row">
          <span class="tl-badge ${badgeCls}">${badgeLabel}</span>
          ${detailRows ? `<span class="tl-more" onclick="toggleStepDetail(${i})">details ▾</span>` : ""}
        </div>
        ${detailRows ? `<div class="tl-detail" id="stepd-${i}" style="display:none;">${detailRows}</div>` : ""}
        ${extra}
      </div>
    </div>`;
}

// -- Checks-card renderers (EDI-specific) --
// EDI rows: Fraud/redflag, Risk Decision, Credit Score, Account Aggregator, GST, Udyam, VKYC, Audit review.

function renderFraudCheck(data) {
  const statusCls = { hard_block:"check-fail", dedupe_conflict:"check-fail", audit_declined:"check-fail", flagged:"check-flag", clear:"check-clear" }[data?.status] || "";
  const statusLabel = { hard_block:"Fraud hard block", dedupe_conflict:"Dedupe conflict", audit_declined:"Audit declined", flagged:"Flagged (other)", clear:"Clear" }[data?.status] || (data?.status || "—");
  if (!data) return `<div class="check-row"><span class="check-row-label">Fraud / redflag</span><span class="check-na">N/A</span></div>`;
  return `<div class="check-row">
    <span class="check-row-label">Fraud / redflag</span>
    <span class="check-status ${statusCls}">${statusLabel}</span>
    ${data.reason ? `<span class="check-reason">${data.reason}</span>` : ""}
    <span class="check-ts">${data.ts || "—"}</span>
  </div>`;
}

function renderRiskCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">Risk decision</span><span class="check-na">Not reached</span></div>`;
  const cls = { approved:"check-clear", rejected:"check-fail", pending:"check-soft" }[data.status] || "";
  const label = { approved:"Approved", rejected:"Rejected", pending:"Pending" }[data.status] || data.status;
  return `<div class="check-row">
    <span class="check-row-label">Risk decision</span>
    <span class="check-status ${cls}">${label}</span>
    ${data.reason ? `<span class="check-reason">${data.reason}</span>` : ""}
    <span class="check-ts">${data.ts || "—"}</span>
  </div>`;
}

function renderCreditScoreCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">Credit score</span><span class="check-na">Not fetched</span></div>`;
  const cls = data.score >= 700 ? "check-clear" : data.score >= 600 ? "check-soft" : "check-fail";
  return `<div class="check-row">
    <span class="check-row-label">Credit score</span>
    <span class="check-status ${cls}">${data.score}</span>
    ${data.source ? `<span class="check-reason">${data.source}</span>` : ""}
    <span class="check-ts">${data.ts || "—"}</span>
  </div>`;
}

function renderAACheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">Account Aggregator</span><span class="check-na">Not reached</span></div>`;
  const cls = { linked:"check-clear", partial:"check-soft", failed:"check-fail", pending:"check-soft" }[data.status] || "";
  const label = { linked:"Banks linked", partial:"Partial (some failed)", failed:"Failed", pending:"Pending" }[data.status] || data.status;
  return `<div class="check-row">
    <span class="check-row-label">Account Aggregator</span>
    <span class="check-status ${cls}">${label}</span>
    ${data.detail ? `<span class="check-reason">${data.detail}</span>` : ""}
    <span class="check-ts">${data.ts || "—"}</span>
  </div>`;
}

function renderGstCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">GST</span><span class="check-na">N/A</span></div>`;
  const verified = data.status === "verified";
  const cls = verified ? "check-clear" : "check-soft";
  const label = verified ? "Verified" : "Not verified";
  return `<div class="check-row">
    <span class="check-row-label">GST</span>
    <span class="check-status ${cls}">${label}</span>
    <span class="check-reason">${verified ? (data.source || "bureau_id_gstin_advanced_details") : (data.note || "May be gating depending on CPV region")}</span>
    ${data.ts ? `<span class="check-ts">${data.ts}</span>` : ""}
  </div>`;
}

function renderUdyamCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">Udyam</span><span class="check-na">N/A</span></div>`;
  const verified = data.status === "verified";
  const cls = verified ? "check-clear" : "check-fail";
  const label = verified ? "Verified" : "Not verified";
  return `<div class="check-row">
    <span class="check-row-label">Udyam</span>
    <span class="check-status ${cls}">${label}</span>
    <span class="check-reason">${verified ? "Udyam Registration Number verified" : "Udyam verification failed or pending"}</span>
    ${data.ts ? `<span class="check-ts">${data.ts}</span>` : ""}
  </div>`;
}

function renderVkycCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">VKYC</span><span class="check-na">Not reached</span></div>`;
  const cls = { APPROVED:"check-clear", REJECTED:"check-fail", PENDING:"check-soft" }[data.status] || "";
  const label = { APPROVED:"Approved", REJECTED:"Rejected", PENDING:"Pending" }[data.status] || data.status;
  return `<div class="check-row">
    <span class="check-row-label">VKYC</span>
    <span class="check-status ${cls}">${label}</span>
    ${data.rejectionReason ? `<span class="check-reason">${data.rejectionReason}</span>` : ""}
    <span class="check-ts">${data.ts || "—"}</span>
  </div>`;
}

function renderAuditCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">Audit review</span><span class="check-na">Not triggered</span></div>`;
  const cls = { under_review:"check-soft", approved:"check-clear", declined:"check-fail" }[data.status] || "";
  const label = { under_review:"Under review", approved:"Approved (post-audit)", declined:"Declined" }[data.status] || data.status;
  return `<div class="check-row">
    <span class="check-row-label">Audit review</span>
    <span class="check-status ${cls}">${label}</span>
    ${data.reason ? `<span class="check-reason">${data.reason}</span>` : ""}
    <span class="check-ts">${data.ts || "—"}</span>
  </div>`;
}

// -- DSA-ported check renderers --

function renderSIMCheck(data) {
  if (!data) return '<div class="check-row"><span class="check-row-label">SIM binding</span><span class="check-na">N/A</span></div>';
  const bound = data.status === "success";
  const statusCls = bound ? "check-clear" : "check-fail";
  const statusLabel = bound ? "Done" : "Not done";
  return '<div class="check-row">' +
    '<span class="check-row-label">SIM binding</span>' +
    '<span class="check-status ' + statusCls + '">' + statusLabel + '</span>' +
    (data.reason ? '<span class="check-reason">' + data.reason + '</span>' : "") +
    (data.ts ? '<span class="check-ts">' + data.ts + '</span>' : "") +
    '</div>';
}

function renderAMLCheck(data) {
  if (!data) return '<div class="check-row"><span class="check-row-label">AML</span><span class="check-na">N/A</span></div>';
  const cls = data.status === "verified" ? "check-clear" : (data.match ? "check-fail" : "check-soft");
  const label = { verified: "Verified", pending: "Pending" }[data.status] || data.status;
  const matchTxt = data.match ? "Possible match found" : "No match";
  return '<div class="check-row">' +
    '<span class="check-row-label">AML</span>' +
    '<span class="check-status ' + cls + '">' + label + '</span>' +
    '<span class="check-reason">' + matchTxt + (data.reason ? " -- " + data.reason : "") + '</span>' +
    (data.ts ? '<span class="check-ts">' + data.ts + '</span>' : "") +
    '</div>';
}

function renderManualReviewCheck(data) {
  if (!data) return '<div class="check-row"><span class="check-row-label">Manual review</span><span class="check-na">Not triggered</span></div>';
  const typeLabel = data.type === "fia" ? "FIA" : "KYC Ops";
  const statusCls = {under_review:"check-soft", cleared:"check-clear", rejected:"check-fail"}[data.status] || "";
  const statusLabel = {under_review:"Under review", cleared:"Cleared", rejected:"Rejected"}[data.status] || data.status;
  return '<div class="check-row">' +
    '<span class="check-row-label">Manual review</span>' +
    '<span class="check-status ' + statusCls + '">' + typeLabel + ' -- ' + statusLabel + '</span>' +
    (data.reason ? '<span class="check-reason">' + data.reason + '</span>' : "") +
    '<span class="check-ts">' + data.ts + '</span>' +
    '</div>';
}

function deriveRiskDecision(app) {
  if (app.riskDecision) return app.riskDecision;
  if (app.risk) return app.risk;
  return null;
}

// -- Event-delivery row (shared) --
function renderEventRow(w) {
  const cls = w.status === 'ok' ? 'wh-ok' : w.status === 'err' ? 'wh-err' : 'wh-muted';
  const label = w.status === 'ok' ? '✓ Received' : w.status === 'err' ? '✗ Not received' : '— Pending';
  return `<div class="wh-row">
          <span class="wh-event">${w.event}</span>
          <span class="wh-right"><span class="${cls}">${label}</span><span class="wh-time">${w.time}</span></span>
        </div>`;
}
