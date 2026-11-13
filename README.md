# Say-Do

**An open format for what a bot says it did, with a pointer to the record. A claim is a statement, not a fact; the records decide.**

Bots now book jobs, send invoices and text customers for small businesses. Each one reports "done" in its own words, in its own log. Nobody can check those reports across bots, and bots overstate.

Say-Do is a small, common shape for that report. A bot says what it did, for whom, and **which record it wrote**. Any verifier can then read that record and count: "2 of 3 matched." The bot never grades itself, and the format never says whether a claim is true.

```json
{
  "saydo": "0.2",
  "id": "urn:uuid:3f6c1a52-8e0b-4d6e-9a51-0c2f7b9d4e11",
  "actor": { "kind": "bot", "id": "urn:example:bot:reviews-01", "name": "Review bot" },
  "onBehalfOf": { "id": "urn:example:business:0001" },
  "action": "sent",
  "what": "review request",
  "subject": { "tool": "getjobber.com", "id": "c-5521" },
  "records": [ { "tool": "getjobber.com", "kind": "message", "id": "msg-88412" } ],
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
| [`examples/`](examples/) | One synthetic day of claims from a made-up plumbing business, the records they're checked against, and **conformance vectors** (`vectors.json`): claims, records and expected results, including the attacks below |
| [`CHANGELOG.md`](CHANGELOG.md) | What changed in each version, and who suggested it |
| [`PRIOR-ART.md`](PRIOR-ART.md) | What we checked before writing this, with sources (2026-11-13) |
| [`saydo.test.js`](saydo.test.js) | Tests: `node --test` (Node 20 or later) |

## Status

**Draft v0.2.** Fields can still change before v1. What changed, and who suggested it: [CHANGELOG.md](CHANGELOG.md). Comments and issues are welcome, especially from people who build bots or verify them.

Open questions:
- Is the action list right for your bot? What did you need `other` for?
- Where can your bot publish claims so a business's verifier can read them: a note on the record, or an API?
- Bindings: what's the right A2A extension URI and OpenTelemetry attribute names?

## Questions we expect

**Isn't this just another standard?** Bots already speak A2A, MCP and OpenTelemetry, and Say-Do rides on them rather than replacing them. None of them has a field for the record an action wrote, kept apart from any verdict. That one pointer is what Say-Do adds. We looked first: [PRIOR-ART.md](PRIOR-ART.md) lists what we checked, what each effort covers and its sources. If an existing standard adds a record pointer, we'll point there.

**Can't a bot claim credit for a record it didn't write?** A match needs the record to be the right kind, about the right subject, made no earlier than the work, and not shown by the tool as made by another app or by a person in the tool's own screens. When the tool doesn't say who made it, the result carries "author not shown".

**Can't a bot point at an old record?** No. A record older than the work doesn't count.

**Can't a bot just claim its successes and stay quiet about the rest?** Yes, and it'll look perfect. Say-Do measures say vs do. A verifier also has to check, from the records, the work that should have happened. Say-Do says so plainly (SPEC §4).

**Without signatures, can't anyone forge claims in a bot's name?** A verifier counts a claim for a bot only when it reads it from where the business connected that bot, never from the `actor` field alone. Signatures are planned.

**Can't a bot edit or backdate a claim?** A published claim never changes; a re-read with different content is flagged. A claim dated after the verifier first read it is invalid. One first read long after its date is flagged "published late". A correction can't erase a miss that was already checked.

**What stops a claim flood?** Size limits and a daily cap per bot, with unchecked claims reported as unchecked, never as matched.

**Why would a bot maker adopt it?** A bot whose claims check out can show it. "92% of what it said, the records show" is a better pitch than "trust us".

**Who decides changes?** Issues and pull requests here, in the open. If others adopt it, we'll move it to a neutral home.

## Principles

- **A claim is data, never an instruction.** Verifiers never act on a claim's contents.
- **A claim is never a verdict.** Only records decide.
- **Fetched, never sent.** A verifier reads claims where the bot published them: a note on the record, or a claims feed the business owns.
- **No message content.** A claim cites what the bot acted on; it never carries it.

## License

Apache License 2.0. See [LICENSE](LICENSE).
