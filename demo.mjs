#!/usr/bin/env node
// wedge-case-2 — handoff-ready is not approval, and approval is not authorization to deploy.
//   npm run demo             initial:  handoff-ready, approval pending, not authorized
//   npm run demo:approved    approval evidence supplied externally (still not authorized)
//   npm run demo:authorized  approval AND authorization evidence supplied externally
//
// No dependencies. No network. No signup. Just Node.js.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { run } from "./model.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function traceLine(t) {
  switch (t.step) {
    case "source-state":
      return `source-state     : workflow=${t.faces.workflow} handoff=${t.faces.handoff} approval=${t.faces.approval} execution=${t.faces.execution}`;
    case "supplied-evidence":
      return `supplied-evidence: ${t.kind} — external, by ${t.supplied_by}${t.supplied_at ? " @ " + t.supplied_at : ""}`;
    case "transition":
      return `transition       : ${t.face}  ${t.from} -> ${t.to}`;
    case "intermediate":
      return `intermediate     : workflow=${t.faces.workflow} handoff=${t.faces.handoff} approval=${t.faces.approval} execution=${t.faces.execution}`;
    case "unchanged-states":
      return `unchanged        : ${t.faces.join(", ")}`;
    case "route":
      return `route            : ${t.subject} -> ${t.current_owner} (remaining_decision: ${t.remaining_decision})`;
    case "remaining-unknown":
      return `remaining-unknown: ${t.items.join("; ")}`;
    case "execution-authorization":
      return `execution-auth   : ${t.value} (requires ${t.requires})`;
    default:
      return JSON.stringify(t);
  }
}

const itemSummary = (items) => {
  const states = [...new Set(items.map((i) => i.state))];
  return `${items.length} items above (${states.join("/")})`;
};

export function render(stages) {
  const r = run(stages);
  const f = r.faces;
  const L = [];

  L.push(`RELEASE: ${r.release_id}`);
  L.push("");
  L.push("items (readiness):");
  for (const it of f.items) L.push(`  ${pad(it.id, 18)}: ${it.state}`);
  L.push("");
  L.push("state faces (six, kept separate — none auto-promotes to the next):");
  L.push(`  ITEM STATE     : ${itemSummary(f.items)}`);
  L.push(`  WORKFLOW STATE : ${f.workflow}`);
  L.push(`  HANDOFF STATE  : ${f.handoff}`);
  L.push(`  APPROVAL STATE : ${f.approval}`);
  L.push(`  EXECUTION STATE: ${f.execution}`);
  L.push(`  ROUTE STATE    : ${f.route.subject} -> ${f.route.routed_to}`);
  L.push(`                   remaining_decision: ${f.route.remaining_decision}`);
  L.push("");
  L.push(`RELEASE PACKET: ${f.handoff}`);
  L.push(`APPROVAL: ${f.approval}`);
  L.push(`DEPLOYMENT: ${f.execution}`);
  L.push("");
  if (f.approval === "APPROVED" && f.execution === "AUTHORIZED") {
    L.push("Approval and authorization evidence were supplied externally.");
    L.push("The demo made neither decision.");
  } else if (f.approval === "APPROVED" && f.execution === "NOT_AUTHORIZED") {
    L.push("Approval evidence was supplied externally.");
    L.push("Deployment authorization is still absent.");
  } else {
    L.push("Handoff-ready. Not approved to deploy.");
  }
  L.push("");
  L.push("trace (append-only):");
  for (const t of r.trace) L.push("  " + traceLine(t));

  return L.join("\n") + "\n";
}

function main() {
  const args = process.argv;
  let stages;
  if (args.includes("--authorized")) stages = [load("initial.json"), load("approval-added.json"), load("authorization-added.json")];
  else if (args.includes("--approved")) stages = [load("initial.json"), load("approval-added.json")];
  else stages = [load("initial.json")];
  process.stdout.write(render(stages));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
