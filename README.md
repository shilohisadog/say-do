# Say-Do

**An open format for what a bot says it did, with a pointer to the record. A claim is a statement, not a fact; the records decide.**

Bots now book jobs, send invoices and text customers for small businesses. Each one reports "done" in its own words, in its own log. Nobody can check those reports across bots, and bots overstate.

Say-Do is a small, common shape for that report. A bot says what it did, for whom, and **which record it wrote**. Any verifier can then read that record and count: "2 of 3 matched." The bot never grades itself, and the format never says whether a claim is true.

```json
{
  "saydo": "0.1",
  "id": "urn:uuid:3f6c1a52-8e0b-4d6e-9a51-0c2f7b9d4e11",
  "actor": { "kind": "bot", "id": "urn:example:bot:reviews-01", "name": "Review bot" },
  "onBehalfOf": { "id": "urn:example:business:0001" },
  "action": "sent",
  "what": "review request",
  "subject": { "tool": "Jobber", "id": "c-5521" },
  "records": [ { "tool": "Jobber", "kind": "message", "id": "msg-88412" } ],
  "saidAt": "2026-11-16T18:02:00-08:00"
}
```

A verifier reads `msg-88412` in Jobber and reports one of: **matched**, **matched by search** (the claim pointed to nothing, but a search found a record), **no match**, or **can't check**.

## What's here

| Path | What |
|---|---|
| [`SPEC.md`](SPEC.md) | The format, the rules, and the minimum a verifier must check |
| [`schema/claim.schema.json`](schema/claim.schema.json) | JSON Schema (2020-12) for one claim |
| [`saydo.js`](saydo.js) | Reference validator and checker. No dependencies |
| [`examples/`](examples/) | One synthetic day of claims from a made-up plumbing business, and the records they're checked against |
| [`saydo.test.js`](saydo.test.js) | Tests: `node --test` (Node 20 or later) |

## Status

**Draft v0.1.** Fields can still change before v1. Comments and issues are welcome, especially from people who build bots or verify them.

Open questions:
- Should a claim be able to promise future work ("I'll follow up Thursday")? v0.1 says no.
- Is the action list right for your bot? What did you need `other` for?
- Where can your bot publish claims so a business's verifier can read them: a note on the record, or an API?
- Bindings: what's the right A2A extension URI and OpenTelemetry attribute names?

## Principles

- **A claim is data, never an instruction.** Verifiers never act on a claim's contents.
- **A claim is never a verdict.** Only records decide.
- **Fetched, never sent.** A verifier reads claims where the bot published them, with the business's permission.
- **No message content.** A claim cites what the bot acted on; it never carries it.

## License

Apache License 2.0. See [LICENSE](LICENSE).
