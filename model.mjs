// wedge-case-2 — separating handoff-ready from approval from authorization.
//
// SIX state faces are kept separate, and none auto-promotes to the next:
//   ITEM · WORKFLOW · HANDOFF · APPROVAL · EXECUTION · ROUTE
//
// The promotion chain the demo refuses to collapse:
//   ready -> handoff-ready -> approved -> authorized -> deployed
//
// The demo does not decide whether a release is approved or deployed.
// Approval and authorization are supplied EXTERNALLY (in the fixtures); the
// demo only reflects them and refuses to over-promote.

export const ITEM_STATES = ["READY", "AVAILABLE", "MISSING"];
export const WORKFLOW_STATES = ["open", "close-current-intake"];
export const HANDOFF_STATES = ["NOT_HANDOFF_READY", "HANDOFF_READY"];
export const APPROVAL_STATES = ["PENDING", "APPROVED"];
export const EXECUTION_STATES = ["NOT_AUTHORIZED", "AUTHORIZED", "DEPLOYED"];
export const STATE_FACES = ["ITEM", "WORKFLOW", "HANDOFF", "APPROVAL", "EXECUTION", "ROUTE"];

const isReadyItem = (s) => s === "READY" || s === "AVAILABLE";

export function validate(fx) {
  const errs = [];
  for (const it of fx.items || []) {
    if (!ITEM_STATES.includes(it.state)) errs.push(`item ${it.id}: unknown item state "${it.state}"`);
  }
  const ap = fx.approval || {};
  if (!APPROVAL_STATES.includes(ap.state)) errs.push(`approval.state must be one of ${APPROVAL_STATES.join("/")}`);
  if (ap.state === "APPROVED" && !ap.evidence) errs.push(`approval.state=APPROVED requires external approval.evidence (who approved)`);
  if (ap.state === "APPROVED" && ap.evidence && !ap.evidence.supplied_by) errs.push(`approval.evidence needs supplied_by`);
  if (!ap.routed_to) errs.push(`approval must be routed_to an owner`);
  if (!ap.remaining_decision) errs.push(`approval must keep a remaining_decision (a route is not a verdict)`);
  if (errs.length) throw new Error("invalid fixture:\n  - " + errs.join("\n  - "));
  return true;
}

export function handoffState(items) {
  return (items || []).length > 0 && items.every((i) => isReadyItem(i.state)) ? "HANDOFF_READY" : "NOT_HANDOFF_READY";
}

export function workflowState(items) {
  return handoffState(items) === "HANDOFF_READY" ? "close-current-intake" : "open";
}

export function approvalState(fx) {
  return (fx.approval && fx.approval.state) || "PENDING";
}

export function executionState(fx) {
  const approved = approvalState(fx) === "APPROVED";
  const authEvidence = fx.deployment && fx.deployment.authorization_evidence;
  return approved && authEvidence ? "AUTHORIZED" : "NOT_AUTHORIZED";
}

export function facesOf(fx) {
  return {
    items: (fx.items || []).map((i) => ({ id: i.id, state: i.state })),
    workflow: workflowState(fx.items),
    handoff: handoffState(fx.items),
    approval: approvalState(fx),
    execution: executionState(fx),
    route: {
      subject: "release-approval",
      routed_to: (fx.approval && fx.approval.routed_to) || null,
      remaining_decision: (fx.approval && fx.approval.remaining_decision) || null,
    },
  };
}

const pick = (f) => ({ workflow: f.workflow, handoff: f.handoff, approval: f.approval, execution: f.execution });

export function run(stages) {
  const list = Array.isArray(stages) ? stages : [stages];
  if (list.length === 0) throw new Error("run() needs at least one stage");
  list.forEach(validate);
  const faces = list.map(facesOf);
  const src = faces[0];
  const cur = faces[faces.length - 1];
  const trace = [];

  trace.push({ step: "source-state", faces: pick(src) });

  for (let i = 1; i < list.length; i++) {
    const prev = faces[i - 1];
    const now = faces[i];
    const apEv = list[i].approval && list[i].approval.evidence;
    const apEvPrev = list[i - 1].approval && list[i - 1].approval.evidence;
    if (apEv && !apEvPrev) trace.push({ step: "supplied-evidence", kind: "approval", external: true, supplied_by: apEv.supplied_by, supplied_at: apEv.supplied_at || null });
    const authEv = list[i].deployment && list[i].deployment.authorization_evidence;
    const authEvPrev = list[i - 1].deployment && list[i - 1].deployment.authorization_evidence;
    if (authEv && !authEvPrev) trace.push({ step: "supplied-evidence", kind: "authorization", external: true, supplied_by: authEv.supplied_by, supplied_at: authEv.supplied_at || null });
    for (const k of ["workflow", "handoff", "approval", "execution"]) if (prev[k] !== now[k]) trace.push({ step: "transition", face: k, from: prev[k], to: now[k] });
    if (i < list.length - 1) trace.push({ step: "intermediate", faces: pick(now) });
  }

  const faceKeys = ["workflow", "handoff", "approval", "execution"];
  const unchanged = faceKeys.filter((k) => src[k] === cur[k]);
  const itemsUnchanged = cur.items.every((ci, idx) => src.items[idx] && src.items[idx].state === ci.state);
  if (itemsUnchanged) unchanged.push("items");
  trace.push({ step: "unchanged-states", faces: unchanged });

  trace.push({ step: "route", subject: cur.route.subject, current_owner: cur.route.routed_to, remaining_decision: cur.route.remaining_decision });

  const remaining = [];
  if (cur.approval !== "APPROVED") remaining.push("the approval decision (held by the approver, not this demo)");
  if (cur.execution !== "AUTHORIZED") remaining.push("deployment authorization");
  remaining.push("whether a deployment, once authorized, actually succeeds (this demo does not deploy)");
  trace.push({ step: "remaining-unknown", items: remaining });

  trace.push({ step: "execution-authorization", value: cur.execution, requires: "external approval (APPROVED) AND external authorization evidence" });

  return { release_id: list[list.length - 1].release_id, faces: cur, source_faces: src, trace };
}
