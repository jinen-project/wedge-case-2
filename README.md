Archived historical specimen.

The current runnable public workflow demo is reliable-ai-workflow-demo.

This repository remains available for provenance and can be reactivated if its specific specimen is needed.

# Wedge Case 2

> A zero-dependency Node.js demo that keeps handoff readiness, approval, and
> deployment authorization separate.

```text
HANDOFF_READY ≠ APPROVED ≠ AUTHORIZED
```

| Run | Handoff | Approval | Deployment |
| --- | --- | --- | --- |
| `npm run demo` | `HANDOFF_READY` | `PENDING` | `NOT_AUTHORIZED` |
| `npm run demo:approved` | `HANDOFF_READY` | `APPROVED` | `NOT_AUTHORIZED` |
| `npm run demo:authorized` | `HANDOFF_READY` | `APPROVED` | `AUTHORIZED` |

It neither approves nor deploys.

## Quick start

Node.js and npm are required. No dependency installation or network connection
is needed.

```bash
npm run demo
npm run demo:approved
npm run demo:authorized
```

The project does not declare a minimum Node.js version. The publication
candidate was verified with Node.js v22.23.1 and npm 10.9.8.

## Expected output

Initial — the packet is ready to hand off, but approval and authorization are
absent:

```text
RELEASE PACKET: HANDOFF_READY
APPROVAL: PENDING
DEPLOYMENT: NOT_AUTHORIZED
```

Approval supplied externally — this is the boundary the demo is designed to
preserve:

```text
RELEASE PACKET: HANDOFF_READY
APPROVAL: APPROVED
DEPLOYMENT: NOT_AUTHORIZED
```

Approval and separate authorization evidence supplied externally:

```text
RELEASE PACKET: HANDOFF_READY
APPROVAL: APPROVED
DEPLOYMENT: AUTHORIZED
```

An exit code of `0` means the requested demo scenario ran successfully. It does
not mean a release was approved, authorized, deployed, or successful in
production.

## Why approval is not authorization

The release packet contains five prepared items: a build artifact, automated
tests, a rollback plan, a license check, and available security evidence. Those
items make the packet `HANDOFF_READY`; they do not create approval.

Approval is read from external approval evidence. Execution becomes
`AUTHORIZED` only when both conditions are true:

```text
approval == APPROVED
AND
external authorization evidence is present
```

Approval alone does not authorize. Authorization evidence without approval
does not authorize. Handoff readiness does not authorize.

## State faces

| Face | What it holds |
| --- | --- |
| `ITEM` | Readiness of each release-preparation item |
| `WORKFLOW` | Progress from intake to handoff |
| `HANDOFF` | Whether the packet can be handed to the next owner |
| `APPROVAL` | An external approver's recorded decision |
| `EXECUTION` | External execution authorization |
| `ROUTE` | The owner of the remaining decision |

None of these faces automatically promotes another.

## Fixtures and trace

Three synthetic fixtures represent the three runs:

| Fixture | Approval evidence | Authorization evidence |
| --- | --- | --- |
| `fixtures/initial.json` | absent | absent |
| `fixtures/approval-added.json` | present | absent |
| `fixtures/authorization-added.json` | present | present |

Each run prints an append-only trace. The authorized run preserves this
intermediate state:

```text
approval=APPROVED execution=NOT_AUTHORIZED
```

The fixture identities, dates, release ID, and evidence values are fictional
and exist only to make the boundary reproducible.

## Tests

```bash
npm test
```

The 16 tests pin the two-sided execution gate, the six separate state faces,
the preserved intermediate trace, deterministic output, and the rule that a
missing preparation item drops the packet below `HANDOFF_READY`.

## Non-goals

This demo does not:

- decide whether a release should be approved;
- issue approval or authorization evidence;
- authenticate approvers or deployment owners;
- deploy anything or verify deployment success;
- implement production access control, concurrency control, or audit storage;
- act as a policy engine, compliance checker, or governance framework.

## Repository structure

```text
.
├── demo.mjs
├── model.mjs
├── test.mjs
├── fixtures/
│   ├── initial.json
│   ├── approval-added.json
│   └── authorization-added.json
├── package.json
├── README.md
└── LICENSE
```

## Wedge Series

- [Wedge Case 0](https://github.com/jinen-project/wedge-case-0) separates
  state and halt categories.
- [Wedge Case 1](https://github.com/jinen-project/wedge-case-1) separates an
  item HOLD from a workflow HOLD.
- Wedge Case 2 separates preparation, approval, and external execution
  authorization.

Each case adds one boundary; it does not replace the earlier cases.

## Respond with an observation

If you run the demo, find a boundary case, or have a question about its stated limits, [open an issue](issues/new/choose). Include only public-safe material: what you tried, the conditions, what you observed, and what you expected.

For related runnable specimens and field notes, visit the [Jinen Project public hub](https://github.com/jinen-project/jinen-project).

## License

[MIT](LICENSE)
