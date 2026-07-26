// wedge-case-2 — executable invariants.  node --test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { run, validate, facesOf, handoffState, approvalState, executionState, STATE_FACES } from "./model.mjs";
import { render } from "./demo.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));
const initial = load("initial.json");
const approvalAdded = load("approval-added.json");
const authorizationAdded = load("authorization-added.json");

const withAuth = (fx) => ({ ...fx, deployment: { authorization_evidence: { supplied_by: "x", supplied_at: "2026-07-18" } } });

test("PENDING + no authorization => NOT_AUTHORIZED", () => {
  assert.equal(executionState(initial), "NOT_AUTHORIZED");
});

test("PENDING + authorization => NOT_AUTHORIZED", () => {
  assert.equal(executionState(withAuth(initial)), "NOT_AUTHORIZED");
});

test("APPROVED + no authorization => NOT_AUTHORIZED", () => {
  assert.equal(approvalState(approvalAdded), "APPROVED");
  assert.equal(executionState(approvalAdded), "NOT_AUTHORIZED");
});

test("APPROVED + authorization => AUTHORIZED", () => {
  assert.equal(approvalState(authorizationAdded), "APPROVED");
  assert.equal(executionState(authorizationAdded), "AUTHORIZED");
});

test("handoff-ready alone promotes neither approval nor execution", () => {
  assert.equal(handoffState(initial.items), "HANDOFF_READY");
  assert.equal(approvalState(initial), "PENDING");
  assert.equal(executionState(initial), "NOT_AUTHORIZED");
});

test("approval evidence alone does not authorize execution", () => {
  assert.ok(approvalAdded.approval.evidence, "approval evidence present");
  assert.equal(approvalAdded.deployment.authorization_evidence, null, "no authorization evidence");
  assert.equal(executionState(approvalAdded), "NOT_AUTHORIZED");
});

test("security evidence available != approved", () => {
  assert.equal(initial.items.find((i) => i.id === "security-evidence").state, "AVAILABLE");
  assert.equal(approvalState(initial), "PENDING");
});

test("APPROVED without external evidence is rejected", () => {
  assert.throws(() => validate({ ...approvalAdded, approval: { ...approvalAdded.approval, evidence: null } }));
});

test("there are six state faces, including ITEM", () => {
  assert.deepEqual(STATE_FACES, ["ITEM", "WORKFLOW", "HANDOFF", "APPROVAL", "EXECUTION", "ROUTE"]);
  const f = facesOf(initial);
  for (const key of ["items", "workflow", "handoff", "approval", "execution", "route"]) assert.ok(key in f, `face ${key} present`);
});

test("items/workflow/handoff identical across the three fixtures", () => {
  assert.deepEqual(initial.items, approvalAdded.items);
  assert.deepEqual(initial.items, authorizationAdded.items);
  assert.equal(handoffState(initial.items), handoffState(authorizationAdded.items));
  assert.equal(workflowStateOf(initial), workflowStateOf(authorizationAdded));
});

function workflowStateOf(fx) {
  return facesOf(fx).workflow;
}

test("authorized run trace is append-only and keeps the intermediate state", () => {
  const r = run([initial, approvalAdded, authorizationAdded]);
  assert.equal(r.trace[0].step, "source-state");
  assert.equal(r.trace[0].faces.approval, "PENDING");
  assert.equal(r.trace[0].faces.execution, "NOT_AUTHORIZED");
  assert.ok(r.trace.some((t) => t.step === "transition" && t.face === "approval" && t.from === "PENDING" && t.to === "APPROVED"));
  assert.ok(r.trace.some((t) => t.step === "intermediate" && t.faces.approval === "APPROVED" && t.faces.execution === "NOT_AUTHORIZED"));
  assert.ok(r.trace.some((t) => t.step === "transition" && t.face === "execution" && t.from === "NOT_AUTHORIZED" && t.to === "AUTHORIZED"));
});

test("initial output contains the required exact lines", () => {
  const out = render([initial]);
  assert.match(out, /RELEASE PACKET: HANDOFF_READY/);
  assert.match(out, /APPROVAL: PENDING/);
  assert.match(out, /DEPLOYMENT: NOT_AUTHORIZED/);
  assert.match(out, /Handoff-ready\. Not approved to deploy\./);
});

test("approved output contains the required exact lines", () => {
  const out = render([initial, approvalAdded]);
  assert.match(out, /RELEASE PACKET: HANDOFF_READY/);
  assert.match(out, /APPROVAL: APPROVED/);
  assert.match(out, /DEPLOYMENT: NOT_AUTHORIZED/);
  assert.match(out, /Approval evidence was supplied externally\./);
  assert.match(out, /Deployment authorization is still absent\./);
});

test("authorized output contains the required exact lines", () => {
  const out = render([initial, approvalAdded, authorizationAdded]);
  assert.match(out, /RELEASE PACKET: HANDOFF_READY/);
  assert.match(out, /APPROVAL: APPROVED/);
  assert.match(out, /DEPLOYMENT: AUTHORIZED/);
  assert.match(out, /Approval and authorization evidence were supplied externally\./);
  assert.match(out, /The demo made neither decision\./);
});

test("deterministic output for all three runs", () => {
  assert.equal(render([initial]), render([initial]));
  assert.equal(render([initial, approvalAdded]), render([initial, approvalAdded]));
  assert.equal(render([initial, approvalAdded, authorizationAdded]), render([initial, approvalAdded, authorizationAdded]));
});

test("a missing item drops handoff below HANDOFF_READY", () => {
  const items = initial.items.map((i) => (i.id === "rollback-plan" ? { ...i, state: "MISSING" } : i));
  assert.equal(handoffState(items), "NOT_HANDOFF_READY");
});
