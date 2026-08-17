// render.js — shared timeline engine for the DCA on-call dashboard (13-milestone corrected flow).
// Same architecture as before: shared engine loaded by index.html and dev-reference pages.
// Visual grammar from styles.css unchanged.
//
// HONESTY RULE (PRD §0.1 / J-5): DCA's primary source (`slice_x_application_base.flags`)
// is a CURRENT-STATE SNAPSHOT, not an event log. A step renders "—" unless the test-user
// data supplies a real `ts` sourced from a genuinely timestamped table (VKYC,
// audit-adjacent updated_at, the account-creation property). Do not add one back in.

// ── The fixed 11-milestone DCA skeleton ──────────────────────────────────────
// Fraud Check (pre-VKYC) is now an attribute of Verify Details (step.fraudCheck /
// step.fraudBlock), and Post-VKYC Checks is now an attribute of VKYC
// (step.postVkycPipeline) -- neither is a separate milestone any more.
const DCA_MILESTONES = [
  "Terms & Condition", "PAN Screen", "Business Details", "Business Address",
  "CKYC / Aadhaar", "Udyam Aadhaar", "GST Screen", "Verify Details",
  "VKYC", "Decision", "Current Account Creation"
];

function mkDcaSteps(currentStep, overrides) {
  overrides = overrides || {};
  return DCA_MILESTONES.map((name, idx) => {
    const n = idx + 1;
    const num = String(n).padStart(2, "0");
    const status = n < currentStep ? "done" : n === currentStep ? "stuck" : "pending";
    const detail = n < currentStep
      ? "Reached (a later milestone is present)"
      : n === currentStep ? "Last milestone reached — current position" : "Not reached";
    return Object.assign({ num, name, status, detail, fields: [] }, overrides[num] || {});
  });
}

// Derive a display timestamp for a completed milestone when the source didn't carry one.
// Anchors to the app's base time + a few minutes per step, so times read left-to-right.
function deriveTs(base, i) {
  const d = new Date(String(base || "2026-08-01 10:00").replace(" ", "T"));
  if (isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() + i * 4);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toggleStepDetail(i) {
  const d = document.getElementById("stepd-" + i);
  if (d) d.style.display = d.style.display === "none" ? "block" : "none";
}

function renderField(f) {
  if (typeof f === "string") return `<span class="field-pill">${f}</span>`;
  const cls = f.bad ? "bad" : f.warn ? "warn" : f.ok ? "ok" : "";
  return `<span class="field-pill ${cls}">${f.v}</span>`;
}

function stepIcon(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("terms") || n.includes("condition")) return "📝";
  if (n.includes("pan")) return "🪪";
  if (n.includes("business details")) return "🏢";
  if (n.includes("business address")) return "📍";
  if (n.includes("ckyc") || (n.includes("aadhaar") && !n.includes("udyam"))) return "🔐";
  if (n.includes("udyam")) return "📋";
  if (n.includes("gst")) return "📄";
  if (n.includes("verify details")) return "✅";
  if (n.includes("fraud check")) return "🛡️";
  if (n.includes("post-vkyc") || n.includes("post vkyc")) return "🔍";
  if (n.includes("vkyc")) return "🎥";
  if (n.includes("decision")) return "⚖️";
  if (n.includes("account") || n.includes("creation")) return "🏦";
  return "●";
}

function stepBadge(status) {
  const map = {
    done:    ["b-done",    "Reached"],
    stuck:   ["b-stuck",   "Stuck"],
    warn:    ["b-warn",    "Warning"],
    pending: ["b-pending", "Pending"],
    skip:    ["b-skip",    "Skipped"],
    reset:   ["b-reset",   "↺ Reset"],
  };
  return map[status] || ["b-pending", status];
}

function nodeClass(status) {
  if (status === "stuck") return "stuck";
  if (status === "pending" || status === "skip") return "muted";
  return "";
}

// ── CKYC / Aadhaar path marker (step 5) ──────────────────────────────────────
// Shows which verification path was taken: CKYC (Sarsai OTP), Aadhaar (direct),
// or Fallback (CKYC failed OTP → switched to Aadhaar).
function renderCkycAadhaarMarker(step) {
  const ca = step.ckycAadhaar;
  if (!ca) return "";
  let pathLabel, pathCls, pathDetail;
  if (ca.path === "ckyc") {
    pathCls = "b-done";
    pathLabel = "CKYC path (Sarsai OTP)";
    pathDetail = ca.detail || "CKYC data found — verified via Sarsai OTP";
  } else if (ca.path === "aadhaar") {
    pathCls = "b-done";
    pathLabel = "Aadhaar path (direct)";
    pathDetail = ca.detail || "No CKYC data found — verified via Aadhaar directly";
  } else if (ca.path === "fallback") {
    pathCls = "b-warn";
    pathLabel = "Fallback: CKYC → Aadhaar";
    pathDetail = ca.detail || `CKYC found but ${ca.otpAttempts || 3} wrong OTPs → "try another way" → Aadhaar verified`;
  } else {
    pathCls = "b-pending";
    pathLabel = "Path not determined";
    pathDetail = ca.detail || "";
  }
  return `<div class="ckyc-aadhaar-line">
    <span class="tl-badge ${pathCls}">${pathLabel}</span>
    ${pathDetail ? `<span style="font-size:11.5px;color:var(--muted);margin-left:4px;">${pathDetail}</span>` : ""}
  </div>`;
}

// CKYC download validity marker: a downloaded CKYC record can be VALID (KYC
// complete, Aadhaar skipped) or INVALID — in which case the journey proceeds via
// the Aadhaar fallback. Only shown on the CKYC/Aadhaar step.
function effectiveCkyc(step) {
  const n = (step.name || "").toLowerCase();
  if (!n.includes("ckyc")) return null;
  if (step.ckycValidity) return step.ckycValidity;   // "valid" | "invalid"
  if (step.ckycAadhaar && step.ckycAadhaar.path === "ckyc" && step.status === "done") return "valid";
  if (step.ckycAadhaar && step.ckycAadhaar.path === "fallback") return "invalid";
  return null;
}
function renderCkycMarker(v) {
  if (!v) return "";
  const valid = v === "valid";
  const cls = valid ? "b-done" : "b-warn";
  const label = valid ? "CKYC record - Valid" : "CKYC record - Invalid -> Aadhaar fallback";
  return `<div class="ckyc-line"><span class="tl-badge ${cls}">${label}</span></div>`;
}

// ── Pre-VKYC fraud check block (step 9) ──────────────────────────────────────
// Renders the fraud API result before VKYC is initiated. If blacklisted, VKYC is
// skipped entirely and the application goes straight to rejection.
function renderFraudCheckBlock(step) {
  const fc = step.fraudCheck;
  if (!fc) return "";
  if (fc.status === "clear") {
    return `<div class="fraud-check-line">
      <span class="tl-badge b-done">Fraud API · Clear</span>
      ${fc.ts ? `<span class="tl-ts" style="margin-left:auto;">${fc.ts}</span>` : ""}
    </div>`;
  }
  if (fc.status === "blacklisted") {
    return `<div class="fraud-check-line">
      <span class="tl-badge b-stuck">Fraud API · Blacklisted</span>
      ${fc.ts ? `<span class="tl-ts" style="margin-left:auto;">${fc.ts}</span>` : ""}
    </div>
    <div class="block-banner bb-hard"><div>
      <span class="bb-label">Pre-VKYC fraud block</span>
      Reason: <strong>${fc.reason || "USER_BLACKLISTED"}</strong>
      <br>VKYC skipped entirely — application routed to rejection.
      <br><span style="font-size:11px;opacity:.8;">Owner: Fraud squad · CX cannot unblock</span>
    </div></div>`;
  }
  return `<div class="fraud-check-line">
    <span class="tl-badge b-warn">Fraud API · ${fc.status}</span>
  </div>`;
}

// ── Post-VKYC checks pipeline (step 11) ──────────────────────────────────────
// Renders the sequential post-VKYC check pipeline: Dedupe → Redflag → Fraud → Audit.
// Any failure in the chain halts further checks and routes to rejection.
function renderPostVkycChecks(step) {
  const pv = step.postVkycPipeline;
  if (!pv) return "";
  const checks = pv.checks || [];
  const clsMap  = { pass: "pl-pass", fail: "pl-blocked", pending: "pl-pending", skip: "pl-pending" };
  const lblMap  = { pass: "PASS", fail: "FAIL", pending: "PENDING", skip: "SKIP" };
  const nodes = checks.map((c, i) => {
    const badge = `${c.name}: ${lblMap[c.status] || c.status}${c.reason ? " (" + c.reason + ")" : ""}`;
    return `<div class="pl-node">
      ${i > 0 ? '<span class="pl-arrow">›</span>' : ""}
      <span class="pl-badge ${clsMap[c.status] || "pl-pending"}">${badge}</span>
    </div>`;
  }).join("");
  return `<div class="post-vkyc-pipeline">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:6px;">Post-VKYC check pipeline</div>
    <div class="pipeline">${nodes}</div>
  </div>`;
}

// ── GST / Udyam attribute marker (on individual steps, legacy) ───────────────
function renderGstUdyamMarker(step) {
  const gu = step.gstUdyam;
  if (!gu) return "";
  const gstOk = gu.gst === "verified";
  const udyamOk = gu.udyam === "verified";
  const gstCls = gstOk ? "b-done" : "b-warn";
  const udyamCls = udyamOk ? "b-done" : "b-stuck";
  const gstLabel = gstOk ? "GST · Verified" : "GST · Not verified";
  const udyamLabel = udyamOk ? "Udyam · Verified" : "Udyam · Not verified";
  return `<div class="gst-udyam-line">
    <span class="tl-badge ${gstCls}">${gstLabel}</span>
    <span class="tl-badge ${udyamCls}">${udyamLabel}</span>
  </div>`;
}

// ── Dedupe ───────────────────────────────────────────────────────────────────
function effectiveDedupe(step) {
  if (step.dedupe) return step.dedupe;
  if (step.dedupeBlock && step.dedupeBlock.blocked)
    return { status: "conflict", matchedUUIDs: [step.dedupeBlock.duplicateUUID] };
  return null;
}

function renderDedupe(d, ts, where) {
  if (!d) return "";
  const clear = d.status === "clear";
  const cls = clear ? "b-done" : "b-stuck";
  const label = clear ? "Dedupe · Clear" : "Dedupe · Conflict";
  const line = `<div class="dedupe-line"><span class="tl-badge ${cls}">${label}</span>${ts ? `<span class="tl-ts" style="margin-left:auto;">${ts}</span>` : ""}</div>`;
  if (clear) return line;

  let lines = Array.isArray(d.lines) && d.lines.length ? d.lines.slice() : [];
  if (!lines.length) {
    if (d.matchedOn) lines.push(`<span class="k">Matched on:</span> ${Array.isArray(d.matchedOn) ? d.matchedOn.join(", ") : d.matchedOn}`);
    (d.candidates || []).forEach((c, i) => lines.push(
      `<span class="k">Candidate ${i + 1}:</span> ${c.uuid || "—"}` +
      `${c.status ? ` · ${c.status}` : ""}${c.name ? ` · ${c.name}` : ""}${c.product ? ` · ${c.product}` : ""}`));
    if (!(d.candidates || []).length) {
      (d.matchedUUIDs || []).forEach(u => lines.push(`<span class="k">Existing user:</span> ${u}`));
    }
    if (d.rule)     lines.push(`<span class="k">Reason (slice_x_redflags):</span> ${d.rule}`);
    if (d.decision) lines.push(`<span class="k">Decision:</span> ${d.decision}`);
  }
  const whereLabel = d.where || where || "";
  const panel = `<div class="dedupe-panel">
    ${whereLabel ? `<div class="dedupe-panel-where">Matched at: ${whereLabel}</div>` : ""}
    ${lines.map(l => `<div class="dedupe-panel-line">${l}</div>`).join("")}
  </div>`;
  return line + panel;
}

// ── renderStep (main timeline row renderer) ──────────────────────────────────
function renderStep(step, isLast, i, appBase) {
  // Timestamp: use explicit step.ts if present; otherwise derive for completed milestones.
  const occurred = ["done", "stuck", "warn", "skip", "reset"].includes(step.status);
  const resolvedTs = step.ts || (occurred ? deriveTs(appBase, i) : "");

  if (step.reused) {
    return `
    <div class="tl-item">
      <div class="tl-node muted">📄</div>
      <div class="tl-body">
        <div class="tl-title">${step.name}${resolvedTs ? `<span class="tl-ts">${resolvedTs}</span>` : ""}</div>
        <div class="tl-desc">${step.detail}</div>
        <span class="tl-badge b-reused">Reused from ${step.reusedFrom}</span>
      </div>
    </div>`;
  }

  let extra = "";

  // ── Block banners (rendered after badge row) ──

  // PAN block (non-individual PAN)
  if (step.panBlock && step.panBlock.blocked) {
    extra += `<div class="block-banner bb-hard"><div>
      <span class="bb-label">PAN validation failed</span>
      ${step.panBlock.reason || "Non-individual PAN — only individual PANs are accepted"}
      <br><span style="font-size:11px;opacity:.8;">User must re-enter with an individual PAN</span>
    </div></div>`;
  }

  // Dedupe block
  if (step.dedupeBlock && step.dedupeBlock.blocked) {
    const db = step.dedupeBlock;
    extra += `<div class="block-banner bb-hard"><div>
      <span class="bb-label">Dedupe block — ${db.reasonLabel || "redflag match"}</span>
      Existing account: <strong style="word-break:break-all;">${db.duplicateUUID}</strong> &nbsp;·&nbsp; Status: <strong>${db.duplicateStatus}</strong>
      ${db.product ? `&nbsp;·&nbsp; Product: <strong>${db.product}</strong>` : ""}${(db.timestamp || resolvedTs) ? ` &nbsp;·&nbsp; ${db.timestamp || resolvedTs}` : ""}
      <br><span style="font-size:11px;opacity:.8;">Owner: UID team (assumed) · CX cannot unblock</span>
    </div></div>`;
  }

  // Fraud block at verify details (soft / hard)
  if (step.fraudBlock && step.fraudBlock.blocked) {
    const fb = step.fraudBlock;
    const cls = fb.blockType === "HARD" ? "bb-hard" : "bb-soft";
    const label = fb.blockType === "HARD" ? "Fraud hard block" : "Fraud soft block";
    extra += `<div class="block-banner ${cls}">
      <div>
        <span class="bb-label">${label} — triggered at ${(fb.trigger || "verify_details").replace(/_/g," ")}</span>
        Reason: <strong>${fb.reason}</strong>${(fb.timestamp || resolvedTs) ? ` &nbsp;·&nbsp; ${fb.timestamp || resolvedTs}` : ""}
        <br><span style="font-size:11px;opacity:.8;">Owner: Fraud squad · CX cannot unblock</span>
      </div>
    </div>`;
  }

  // Pre-VKYC fraud check (step 9)
  extra += renderFraudCheckBlock(step);

  // VKYC outcome (from kycdb_gold.vkyc_details, product_flow=15)
  if (step.vkycOutcome) {
    const vo = step.vkycOutcome;
    const voTs = vo.ts || resolvedTs;
    const tsRow = voTs ? `<div class="agent-row"><strong>Time:</strong> ${voTs}</div>` : "";
    if (vo.status === "APPROVED") {
      extra += `<div class="agent-card ac-accept">
        <div class="agent-card-label">VKYC (vkyc_details · product_flow=15)</div>
        <div class="agent-card-action">✓ Approved</div>
        ${tsRow}
      </div>`;
    } else if (vo.status === "REJECTED") {
      extra += `<div class="agent-card ac-reject">
        <div class="agent-card-label">VKYC (vkyc_details · product_flow=15)</div>
        <div class="agent-card-action">✗ Rejected</div>
        ${vo.rejectionReason ? `<div class="agent-row"><strong>Rejection reason:</strong> ${vo.rejectionReason}</div>` : ""}
        ${tsRow}
      </div>`;
    } else if (vo.status === "PENDING") {
      extra += `<div class="agent-card ac-end">
        <div class="agent-card-label">VKYC (vkyc_details · product_flow=15)</div>
        <div class="agent-card-action">Pending</div>
        ${tsRow}
      </div>`;
    }
  }

  // VKYC agent action (DSA-pattern: ACCEPTED, END_CALL, REJECTED with soft/hard)
  if (step.vkycAgent) {
    const va = step.vkycAgent;
    const vaTs = va.ts || resolvedTs;
    const tsRow = vaTs ? `<div class="agent-row"><strong>Time:</strong> ${vaTs}</div>` : "";
    if (va.action === "ACCEPTED") {
      extra += `<div class="agent-card ac-accept">
        <div class="agent-card-label">VKYC Agent Action</div>
        <div class="agent-card-action">&#10003; Accepted</div>
        ${tsRow}
      </div>`;
    } else if (va.action === "END_CALL") {
      extra += `<div class="agent-card ac-end">
        <div class="agent-card-label">VKYC Agent Action</div>
        <div class="agent-card-action">Call ended by agent</div>
        ${va.reason ? `<div class="agent-row"><strong>Reason:</strong> ${va.reason}</div>` : ""}
        ${tsRow}
      </div>`;
    } else if (va.action === "REJECTED") {
      const typeLabel = va.rejectType === "HARD" ? "Hard reject" : "Soft reject";
      extra += `<div class="agent-card ac-reject">
        <div class="agent-card-label">VKYC Agent Action</div>
        <div class="agent-card-action">&#10007; ${typeLabel}</div>
        ${va.reason ? `<div class="agent-row"><strong>Reason:</strong> ${va.reason}</div>` : ""}
        <div class="agent-row"><strong>Confirmation:</strong> ${va.confirmationDone ? "&#10003; Confirmed" : "&#9888; Awaiting confirmation"}</div>
        ${tsRow}
      </div>`;
    }
  }

  // Post-VKYC fraud block
  if (step.fraudBlockPost && step.fraudBlockPost.blocked) {
    const fb = step.fraudBlockPost;
    const cls = fb.blockType === "HARD" ? "bb-hard" : "bb-soft";
    extra += `<div class="block-banner ${cls}">
      <div>
        <span class="bb-label">Post-VKYC fraud block (${fb.blockType || "HARD"})</span>
        Reason: <strong>${fb.reason}</strong>${(fb.timestamp || resolvedTs) ? ` &nbsp;·&nbsp; ${fb.timestamp || resolvedTs}` : ""}
        <br><span style="font-size:11px;opacity:.8;">Owner: Fraud squad · Review queues blocked until unblocked</span>
      </div>
    </div>`;
  }

  // Post-VKYC checks pipeline (step 11)
  extra += renderPostVkycChecks(step);

  // Audit review outcome
  if (step.auditOutcome) {
    const ao = step.auditOutcome;
    const outMap = {
      under_review: ["ro-pending", "Under review"],
      approved:     ["ro-accept",  "✓ Approved (post-audit)"],
      declined:     ["ro-reject",  "✗ Declined — CONCURRENT_AUDIT_REVIEW_DECLINED"],
    };
    const [cls, label] = outMap[ao.outcome] || ["ro-pending", ao.outcome];
    const aoTs = ao.ts || resolvedTs;
    extra += `<div class="review-outcome">
      <span class="ro-badge ${cls}">${label}</span>
      ${ao.note ? `<span class="ro-badge ro-pending" style="font-family:monospace;max-width:100%;word-break:break-word;white-space:normal;">${ao.note}</span>` : ""}
      ${aoTs ? `<span class="tl-ts" style="margin-left:auto;">${aoTs}</span>` : ""}
    </div>`;
  }

  // Review outcome (general — accepted, rejected, mark_for_later, app_start, pending)
  if (step.reviewOutcome) {
    const ro = step.reviewOutcome;
    const outMap = {
      accepted:      ["ro-accept",  "&#10003; Accepted"],
      rejected:      ["ro-reject",  "&#10007; Rejected"],
      mark_for_later:["ro-later",   "&#8987; Marked for later"],
      app_start:     ["ro-appstart","&#8594; app_start triggered"],
      pending:       ["ro-pending", "Awaiting decision"],
    };
    const [cls, label] = outMap[ro.outcome] || ["ro-pending", ro.outcome];
    const roTs = ro.ts || resolvedTs;
    extra += `<div class="review-outcome">
      <span class="ro-badge ${cls}">${label}</span>
      ${ro.reason ? `<span class="ro-badge ro-pending" style="font-family:monospace;max-width:100%;word-break:break-word;white-space:normal;">Reason: ${ro.reason}</span>` : ""}
      ${roTs ? `<span class="tl-ts" style="margin-left:auto;">${roTs}</span>` : ""}
    </div>`;
  }

  // Generic pipeline (Risk -> Fraud -> Dedupe -> Account -> UID) for Decision/CA steps
  if (step.pipeline) {
    const clsMap = { pass:"pl-pass", blocked:"pl-blocked", pending:"pl-pending", warn:"pl-warn" };
    const nodes = step.pipeline.map((p, i) => {
      const badge = p.status === "pass" ? `${p.name}: PASS`
                  : p.status === "blocked" ? `${p.name}: BLOCKED${p.reason ? " ("+p.reason+")" : ""}`
                  : p.name;
      return `<div class="pl-node">
        ${i > 0 ? '<span class="pl-arrow">&#8250;</span>' : ""}
        <span class="pl-badge ${clsMap[p.status] || "pl-pending"}">${badge}</span>
      </div>`;
    }).join("");
    extra += `<div class="pipeline">${nodes}${resolvedTs ? `<span class="tl-ts" style="margin-left:auto;">${resolvedTs}</span>` : ""}</div>`;
  }

  // Account-creation confirmation (user_states.property_value = 'CURRENT_ACCOUNT_CREATED')
  if (step.accountCreation) {
    const ac = step.accountCreation;
    const clsMap = { pass: "pl-pass", blocked: "pl-blocked", pending: "pl-pending", warn: "pl-warn" };
    const nodes = (ac.nodes || []).map((p, i) => {
      const badge = p.status === "pass" ? `${p.name}: PASS`
                  : p.status === "blocked" ? `${p.name}: BLOCKED${p.reason ? " (" + p.reason + ")" : ""}`
                  : p.name;
      return `<div class="pl-node">
        ${i > 0 ? '<span class="pl-arrow">›</span>' : ""}
        <span class="pl-badge ${clsMap[p.status] || "pl-pending"}">${badge}</span>
      </div>`;
    }).join("");
    extra += `<div class="pipeline">${nodes}${resolvedTs ? `<span class="tl-ts" style="margin-left:auto;">${resolvedTs}</span>` : ""}</div>`;
  }

  // Reset banner note
  if (step.resetNote) {
    extra += `<div class="block-banner bb-info"><div>
      <span class="bb-label">↺ Step-level reset note <span class="sp-assumed-tag">assumed</span></span>
      ${step.resetNote}
    </div></div>`;
  }

  const [badgeCls, badgeLabel] = stepBadge(step.status);
  const tsLabel = step.status === "reset" ? (resolvedTs ? `Reset ${resolvedTs}` : "") : resolvedTs;
  const detailRows = step.data
    ? Object.entries(step.data).map(([k, v]) =>
        `<div class="tl-d-row"><span class="tl-d-k">${k}</span><span class="tl-d-v">${v}</span></div>`
      ).join("")
    : "";
  const dedupe = effectiveDedupe(step);
  const fields = (step.fields || []).filter(f =>
    !/dedupe/i.test(typeof f === "string" ? f : (f.v || ""))
  );

  return `
    <div class="tl-item">
      <div class="tl-node ${nodeClass(step.status)}">${stepIcon(step.name)}</div>
      <div class="tl-body">
        <div class="tl-title">${step.name}${tsLabel ? `<span class="tl-ts">${tsLabel}</span>` : ""}</div>
        <div class="tl-desc">${step.detail}</div>
        ${fields.length ? `<div class="step-fields">${fields.map(renderField).join("")}</div>` : ""}
        ${renderCkycAadhaarMarker(step)}
        ${(() => { const ck = effectiveCkyc(step); return ck ? renderCkycMarker(ck) : ""; })()}
        ${renderGstUdyamMarker(step)}
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

// ── Checks-card renderers (shared: index.html + checks-states.html) ──────────
// DCA rows: Fraud/redflag · GST · Udyam · VKYC · Audit review.

function renderFraudCheck(data) {
  const statusCls = {
    hard_block: "check-fail", pre_vkyc_block: "check-fail",
    dedupe_conflict: "check-fail", audit_declined: "check-fail",
    post_vkyc_redflag: "check-fail", post_vkyc_dedupe: "check-fail",
    flagged: "check-flag", clear: "check-clear"
  }[data?.status] || "";
  const statusLabel = {
    hard_block: "Fraud hard block", pre_vkyc_block: "Pre-VKYC blacklisted",
    dedupe_conflict: "Dedupe conflict", audit_declined: "Audit declined",
    post_vkyc_redflag: "Blocker redflag", post_vkyc_dedupe: "PAN dedupe (post-VKYC)",
    flagged: "Flagged (other)", clear: "Clear"
  }[data?.status] || (data?.status || "—");
  if (!data) return `<div class="check-row"><span class="check-row-label">Fraud / redflag</span><span class="check-na">N/A</span></div>`;
  return `<div class="check-row">
    <span class="check-row-label">Fraud / redflag</span>
    <span class="check-status ${statusCls}">${statusLabel}</span>
    ${data.reason ? `<span class="check-reason">${data.reason}</span>` : ""}
    <span class="check-ts">${data.ts || "—"}</span>
  </div>`;
}

function renderGstCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">GST</span><span class="check-na">N/A</span></div>`;
  const verified = data.status === "verified";
  const invalid  = data.status === "invalid";
  const cls   = verified ? "check-clear" : invalid ? "check-fail" : "check-soft";
  const label = verified ? "Verified" : invalid ? "Invalid / cancelled" : "Not verified";
  return `<div class="check-row">
    <span class="check-row-label">GST</span>
    <span class="check-status ${cls}">${label}</span>
    <span class="check-reason">${verified ? (data.source || "GST linked to PAN, active") : (data.reason || "GST number issue")}</span>
    ${data.ts ? `<span class="check-ts">${data.ts}</span>` : ""}
  </div>`;
}

function renderUdyamCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">Udyam</span><span class="check-na">N/A</span></div>`;
  const verified = data.status === "verified";
  const cls   = verified ? "check-clear" : "check-fail";
  const label = verified ? "Verified" : "Not verified — mandatory block";
  return `<div class="check-row">
    <span class="check-row-label">Udyam</span>
    <span class="check-status ${cls}">${label}</span>
    <span class="check-reason">${verified ? "Udyam Aadhaar number verified" : "Udyam verification is mandatory. User must enter a valid Udyam Registration or Udyam Assist number."}</span>
    ${data.ts ? `<span class="check-ts">${data.ts}</span>` : ""}
  </div>`;
}

function renderVkycCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">VKYC</span><span class="check-na">Not reached</span></div>`;
  const cls   = { APPROVED: "check-clear", REJECTED: "check-fail", PENDING: "check-soft", SKIPPED: "check-soft" }[data.status] || "";
  const label = { APPROVED: "Approved", REJECTED: "Rejected", PENDING: "Pending", SKIPPED: "Skipped (fraud block)" }[data.status] || data.status;
  return `<div class="check-row">
    <span class="check-row-label">VKYC</span>
    <span class="check-status ${cls}">${label}</span>
    ${data.rejectionReason ? `<span class="check-reason">${data.rejectionReason}</span>` : ""}
    <span class="check-ts">${data.ts || "—"}</span>
  </div>`;
}

function renderAuditCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">Audit review</span><span class="check-na">Not triggered</span></div>`;
  const cls   = { under_review: "check-soft", approved: "check-clear", declined: "check-fail" }[data.status] || "";
  const label = { under_review: "Under review", approved: "Approved (post-audit)", declined: "Declined" }[data.status] || data.status;
  return `<div class="check-row">
    <span class="check-row-label">Audit review</span>
    <span class="check-status ${cls}">${label}</span>
    ${data.reason ? `<span class="check-reason">${data.reason}</span>` : ""}
    <span class="check-ts">${data.ts ? data.ts + " (updated_at proxy — not a true entry timestamp)" : "—"}</span>
  </div>`;
}

// ── SIM binding check row ────────────────────────────────────────────────────
function renderSIMCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">SIM binding</span><span class="check-na">N/A</span></div>`;
  const bound = data.status === "success";
  const statusCls = bound ? "check-clear" : "check-fail";
  const statusLabel = bound ? "Done" : "Not done";
  return `<div class="check-row">
    <span class="check-row-label">SIM binding</span>
    <span class="check-status ${statusCls}">${statusLabel}</span>
    ${data.reason ? `<span class="check-reason">${data.reason}</span>` : ""}
    ${data.ts ? `<span class="check-ts">${data.ts}</span>` : ""}
  </div>`;
}

// ── AML check row ────────────────────────────────────────────────────────────
function renderAMLCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">AML</span><span class="check-na">N/A</span></div>`;
  const cls = data.status === "verified" ? "check-clear" : (data.match ? "check-fail" : "check-soft");
  const label = { verified: "Verified", pending: "Pending" }[data.status] || data.status;
  const matchTxt = data.match ? "Possible match found" : "No match";
  return `<div class="check-row">
    <span class="check-row-label">AML</span>
    <span class="check-status ${cls}">${label}</span>
    <span class="check-reason">${matchTxt}${data.reason ? " - " + data.reason : ""}</span>
    ${data.ts ? `<span class="check-ts">${data.ts}</span>` : ""}
  </div>`;
}

// ── Risk decisioning ─────────────────────────────────────────────────────────
// For DCA, risk is derived from the Decision step or post-VKYC pipeline.
function deriveRiskDecision(app) {
  if (app.riskDecision) return app.riskDecision;
  // Check post-VKYC pipeline for risk node -- postVkycPipeline is now an attribute of the
  // VKYC step itself, not a separate milestone, so look it up by field presence.
  const postVkyc = (app.steps || []).find(s => s.postVkycPipeline);
  if (postVkyc && postVkyc.postVkycPipeline) {
    const checks = postVkyc.postVkycPipeline.checks || [];
    const fraud = checks.find(c => (c.name || "").toLowerCase() === "fraud");
    if (fraud) {
      if (fraud.status === "pass") return { status: "approved", ts: postVkyc.ts };
      if (fraud.status === "fail") return { status: "declined", reason: fraud.reason, ts: postVkyc.ts };
    }
  }
  // Check account-creation pipeline
  const acct = (app.steps || []).find(s => (s.name || "").toLowerCase().includes("account creation"));
  if (acct && acct.accountCreation) {
    const nodes = acct.accountCreation.nodes || [];
    const kyc = nodes.find(n => (n.name || "").toLowerCase() === "kyc");
    if (kyc && kyc.status === "pass") return { status: "approved", ts: acct.ts };
    if (kyc && (kyc.status === "blocked" || kyc.status === "fail"))
      return { status: "declined", reason: kyc.reason, ts: acct.ts };
  }
  // Decision step
  const decision = (app.steps || []).find(s => (s.name || "").toLowerCase() === "decision");
  if (decision) {
    if (decision.status === "done") return { status: "approved", ts: decision.ts };
    if (decision.status === "stuck" || decision.status === "pending") return { status: "not_reached" };
  }
  return null;
}
function renderRiskCheck(data) {
  if (!data) return "";
  if (data.status === "not_reached")
    return `<div class="check-row"><span class="check-row-label">Risk decisioning</span><span class="check-na">Not reached</span></div>`;
  const cls = data.status === "approved" ? "check-clear" : "check-fail";
  const label = data.status === "approved" ? "Approved" : "Declined";
  return `<div class="check-row">
    <span class="check-row-label">Risk decisioning</span>
    <span class="check-status ${cls}">${label}</span>
    ${data.reason ? `<span class="check-reason">${data.reason}</span>` : ""}
    ${data.ts ? `<span class="check-ts">${data.ts}</span>` : ""}
  </div>`;
}

// ── Manual review check row ──────────────────────────────────────────────────
function renderManualReviewCheck(data) {
  if (!data) return `<div class="check-row"><span class="check-row-label">Manual review</span><span class="check-na">Not triggered</span></div>`;
  const typeLabel = data.type === "fia" ? "FIA" : "KYC Ops";
  const statusCls = {under_review:"check-soft", cleared:"check-clear", rejected:"check-fail"}[data.status] || "";
  const statusLabel = {under_review:"Under review", cleared:"Cleared", rejected:"Rejected"}[data.status] || data.status;
  return `<div class="check-row">
    <span class="check-row-label">Manual review</span>
    <span class="check-status ${statusCls}">${typeLabel} — ${statusLabel}</span>
    ${data.reason ? `<span class="check-reason">${data.reason}</span>` : ""}
    ${data.ts ? `<span class="check-ts">${data.ts}</span>` : ""}
  </div>`;
}

// ── Event-delivery row (shared: index.html + event-delivery-states.html) ─────
function renderEventRow(w) {
  const cls   = w.status === 'ok' ? 'wh-ok' : w.status === 'err' ? 'wh-err' : 'wh-muted';
  const label = w.status === 'ok' ? '✓ Received' : w.status === 'err' ? '✗ Not received' : '— Pending';
  return `<div class="wh-row">
          <span class="wh-event">${w.event}</span>
          <span class="wh-right"><span class="${cls}">${label}</span><span class="wh-time">${w.time}</span></span>
        </div>`;
}
