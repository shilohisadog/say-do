# Prior art

**Checked 2026-11-13.** Before writing Say-Do, we looked for an existing format that does its job. This page says what we found, what each effort was built for, and why Say-Do still adds something. **If we missed something or got something wrong, please open an issue.** This field moves weekly, and we'd rather point to an existing standard than add one.

**The question we asked:** is there an open format where a bot says *"I did X to record Y in a business's app, for business Z, asked by W"*, kept apart from whether that's true, so an independent verifier can fetch it and check it against the records?

**What we found:** several efforts cover parts of it, and two IETF drafts come close in shape. We didn't find one that **points to the record the action created or changed** in the business's own app. That pointer is the one field a records-based check needs, and it's what Say-Do adds. Each effort below does its own job well. Most of them were built for something else.

---

## The protocols bots already speak

| Effort | Built for | What it covers | What we didn't find in it | How Say-Do relates |
|---|---|---|---|---|
| **A2A** (Agent2Agent), v1.0.0, Linux Foundation's Agentic AI Foundation | Bots talking to bots | Tasks with artifacts (a task's output) and free-form metadata; results fetched or pushed; extensions named by URI | A field for who the bot acted for, or for a record it wrote in another system | Say-Do can ride as an A2A artifact extension (SPEC §7) |
| **MCP** (Model Context Protocol), spec 2026-07-28 | Bots calling tools | Tool results with `structuredContent` (checked against an `outputSchema`) and `resource_link`. The spec says clients SHOULD log tool usage for audit | An audit, receipt or claim format | A tool that writes a record can return a Say-Do claim, with a `resource_link` to the record (SPEC §7) |
| **OpenTelemetry GenAI conventions** (agent spans: Development status) | Tracing what an AI app did, for its builders | `invoke_agent` and `execute_tool` spans: agent and tool names and ids; tool arguments and results opt-in for privacy | An end user or principal, a delegation chain, or the id of a record a tool changed | Say-Do can ride as span attributes (SPEC §7) |
| **W3C Verifiable Credentials** (Recommendation) | Signed, checkable statements | Signatures and tamper evidence. Used for agent delegation, e.g. AP2's signed mandates and the Agent Authorization Envelope draft | A shape for what was done to which record | A planned way to sign claims later. A signed claim is still a claim |

## Audit and provenance drafts

| Effort | Built for | What it covers | What we didn't find in it | How Say-Do relates |
|---|---|---|---|---|
| **draft-kuehlewind-audit-architecture** (Kühlewind, Birkholz), individual IETF draft, Informational | Auditing AI agent delegation and interactions | **The closest in shape we found.** Action records with `actor`, `on_behalf_of` and `action {type, target, operation}`; delegation records and a delegation chain; records pulled by an authorized auditor; an auditing service separate from the agent; service-side records counted over the agent's own report | An id for the record an action created, or an outcome | Say-Do uses the same names (`actor`, `onBehalfOf`, a `delegation` chain) and the same pull model. It adds the record pointer and a minimum check against it |
| **draft-sharif-agent-audit-trail** (-09), individual IETF draft, Standards Track | A standard logging format for autonomous agents | Agent id, principal and authority reference, action type, outcome, parent record, hash chaining, optional signatures; verification outside the recorder | A pointer to a business record; `outcome` is reported by the system that recorded it | Complementary: a tamper-evident log of tool calls. Say-Do asks whether the business result exists |
| **W3C PROV** (Recommendation, 2013) | A general provenance vocabulary | `wasAssociatedWith`, `actedOnBehalfOf`, delegation | Nothing specific to bots, by design | Say-Do borrows its terms |

## Signed receipts and related work

| Effort | Built for | How Say-Do relates |
|---|---|---|
| **Signed receipt drafts and projects:** Acta signed receipts, AER-1, XAIP receipts, Vaara receipts, a SCITT AI-agent receipt profile, Delegation Receipts, the Agent Receipts project | Proving a tool call happened and wasn't altered | They prove the *call*. Say-Do checks whether the *business result* exists. The two fit together: a receipt could carry a Say-Do claim |
| **AP2** (agent payments) | Signed mandates: what a person authorized a bot to buy | The *before* side: authorization. Say-Do is the *after* side |
| **W3C community groups:** AI Agent Protocol; Agent Identity Registry | Agent identity and authorization | Identity, not claims of work. Worth watching |
| **DARP** (Durable Activity Record Protocol) | Coding agents reporting their own work records | Close in spirit: a bot reports its own work in an open format. We read a summary, not the full spec. Corrections welcome |
| **Practitioner writing:** "treat done as a claim", false-completion metrics, Salesforce's CRM agent benchmark | Evaluating agents by the end state of the system of record, not the agent's report | The same premise as Say-Do. We didn't find a shared format for it |

---

## What this means for Say-Do

- **Ride on, don't replace.** Bots already speak A2A, MCP and OpenTelemetry. Say-Do is one small object those can carry.
- **Reuse names that exist:** `actor`, `onBehalfOf` and a `delegation` chain, from W3C PROV and draft-kuehlewind.
- **Add only what's missing:** the pointer to the record (`records`), the rule that a claim is never a verdict, and a minimum check two verifiers can agree on (SPEC §4).
- **If an existing standard adds a record pointer, we'll point there.**

**How we checked:** web searches, plus a reading of the A2A and MCP specifications, the OpenTelemetry GenAI convention pages, and the two IETF drafts named above. Some field lists came from partial reads of long documents. We judged the receipt drafts by their abstracts. Treat the details as a starting point and check the sources.

## Sources

- A2A specification: https://a2a-protocol.org/latest/specification/
- MCP specification: https://modelcontextprotocol.io/specification/latest
- OpenTelemetry GenAI conventions: https://github.com/open-telemetry/semantic-conventions-genai
- W3C Verifiable Credentials: https://www.w3.org/TR/vc-data-model-2.0/
- draft-kuehlewind-audit-architecture: https://datatracker.ietf.org/doc/draft-kuehlewind-audit-architecture/
- draft-sharif-agent-audit-trail: https://datatracker.ietf.org/doc/draft-sharif-agent-audit-trail/
- W3C PROV-O: https://www.w3.org/TR/prov-o/
- Acta signed receipts: https://datatracker.ietf.org/doc/draft-farley-acta-signed-receipts/
- AER-1: https://rambozambodotdev.gitlab.io/aer1-hub/aer-1.html
- XAIP receipts: https://datatracker.ietf.org/doc/draft-xkumakichi-xaip-receipts/
- Vaara receipts: https://datatracker.ietf.org/doc/draft-sirkkavaara-vaara-receipt/
- SCITT AI-agent receipt: https://datatracker.ietf.org/doc/draft-noa-scitt-ai-agent-receipt/
- Delegation Receipts: https://datatracker.ietf.org/doc/draft-nelson-agent-delegation-receipts/
- Agent Authorization Envelope: https://datatracker.ietf.org/doc/draft-kroehl-agentic-trust-aae/
- Agent Receipts project: https://github.com/agent-receipts/ar
- W3C AI Agent Protocol Community Group: https://www.w3.org/groups/cg/agentprotocol
- W3C Agent Identity Registry Community Group: https://www.w3.org/groups/cg/agent-identity/
- DARP: https://flaviocopes.com/darp
- Treat done as a claim: https://dev.to/relayshield/treat-done-as-a-claim-not-a-fact-identity-intent-and-content-checked-together-3ocj
- Salesforce, measuring agent outcomes: https://engineering.salesforce.com/how-to-evaluate-production-ai-agents-measure-system-outcomes-not-conversations/
