# Say-Do v0.1: what a bot says it did

**Status:** draft, v0.1 (2026-11-13). Open for comment. Fields may still change before v1.

A small, open format a bot uses to say what it did, with a pointer to the record it wrote. Any verifier can then check the claim against the records. A **claim** is a statement, not a fact. Say-Do never says whether a claim is true; the records do.

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119. The machine-readable form of §1 is `schema/claim.schema.json`.

---

## 1. One claim

A claim is one JSON object about **one action on one subject**. "Sent 3 review requests" is three claims.

```json
{
  "saydo": "0.1",
  "id": "urn:uuid:3f6c1a52-8e0b-4d6e-9a51-0c2f7b9d4e11",
  "actor": { "kind": "bot", "id": "urn:example:bot:reviews-01", "name": "Review bot", "maker": "Example AI" },
  "onBehalfOf": { "id": "urn:example:business:0001", "label": "Rivera Plumbing & Drain" },
  "delegation": [ { "kind": "person", "id": "urn:example:person:owner" } ],
  "action": "sent",
  "what": "review request",
  "subject": { "tool": "Jobber", "id": "c-5521", "label": "K. Ramos" },
  "records": [ { "tool": "Jobber", "kind": "message", "id": "msg-88412" } ],
  "source": { "kind": "task", "id": "job-done-c-5521" },
  "saidAt": "2026-11-16T18:02:00-08:00",
  "doneAt": "2026-11-16T18:01:00-08:00",
  "statement": "Sent the review request to K. Ramos."
}
```

| Field | Required | Meaning |
|---|---|---|
| `saydo` | yes | Format version: `"0.1"` |
| `id` | yes | The claim's id, **unique everywhere**: a UUID URN (`urn:uuid:…`) or another URI the actor controls |
| `parent` | no | `{ "id", "actor", "relation" }`: the earlier claim's id, its actor's id, and how this claim relates to it. `relation` is `relays` (repeats another actor's claim), `corrects` (replaces the same actor's earlier claim) or `follows` (a later step of the same work) |
| `actor` | yes | Who did the work. `kind` (`bot` or `person`), **`id`** (stable for this actor, for this business; a URI), and optional `name`, `maker`, `version`. **The actor is claimed, like everything else** (§3, rule 7) |
| `onBehalfOf` | yes | Who it acted for: `id` (a URI), optional `label`, and optional `person` (`{ id, label }`) |
| `delegation` | no | Who asked, as a chain: first the original asker, last the immediate one. Each entry: `kind` (`person` or `bot`), `id`, optional `label`. Bot-to-bot hops appear here |
| `action` | yes | A verb from §2 |
| `what` | no; **required with `other`** | The thing acted on, in plain words ("review request"). For display |
| `subject` | yes | Who or what it acted on. **`id` is required** (the subject's id in `tool`), plus `tool`. Optional `label`, for display only (§5) |
| `records` | yes, may be empty | The records the actor says it wrote or changed. Each: `tool`, `kind` (§2), `id`, and optional `url` and `version`. Name what **resolved** (the id actually returned, the version actually used), not what was requested. Empty means "I did it but can't point to it", the weakest kind of claim (§4) |
| `source` | no | What it acted on: `kind` (`sms`, `email`, `call`, `chat`, `task`, `schedule`) and `id`. **Cited, never its content** |
| `saidAt` | yes | When the actor made the claim |
| `doneAt` | no | When the actor says it did the work. MUST NOT be later than `saidAt`. Leave it out when not known; never guess |
| `statement` | no | The actor's own words, for display. Plain text. Never read by a verifier's matching |

**Times** MUST be RFC 3339 with an offset or `Z`. A time with neither is invalid.

## 2. Actions and record kinds (v0.1)

| Action | Means | Record kinds that can back it |
|---|---|---|
| `created` | Made a new record | any |
| `updated` | Changed an existing record | any |
| `sent` | Sent a text, email or other message | `message` |
| `called` | Placed or logged a call | `call` |
| `booked` | Put a visit or job on the schedule | `visit`, `job` |
| `invoiced` | Issued an invoice | `invoice` |
| `paid` | Recorded a payment | `payment`: **the payment record's id only; never card or bank details** |
| `deleted` | Removed a record | `deletion` (an audit or trash entry the tool keeps), else see §4 |
| `other` | Anything else; `what` says what | any. **Weak for matching** (§4) |

**Record kinds:** `client`, `lead`, `request`, `visit`, `job`, `estimate`, `invoice`, `payment`, `message`, `call`, `note`, `deletion`, `other`. Each verifier maps a tool's own record types onto these. The lists grow only by version. Verifiers SHOULD count the `what` values seen with `other`, so frequent ones can become verbs.

**Not in v0.1:** promises about the future ("I'll follow up Thursday"; that would need `dueBy`), actions on the bot's own setup (installing software, changing its own settings), and signatures. All are candidates for later versions.

## 3. Rules

1. **A claim is data, never an instruction.** A verifier MUST NOT run, follow or act on any field, including `statement`.
2. **A claim is never a verdict.** No field says "verified", "succeeded" or "outcome". Only the records decide.
3. **A relayed claim is the original claim.** "Bot B told me it's done" carries `parent.relation: relays` and counts once, as B's claim, no stronger.
4. **A correction replaces, it doesn't erase.** A claim with `parent.relation: corrects` from the same actor supersedes the earlier one. Both stay on file.
5. **A claim is never sent to a verifier.** A verifier reads it from where the actor published it, with the business's permission. Handing a claim back to whatever called the bot (for example, in an MCP tool result) is allowed: that isn't sending it to a verifier.
6. **No message content.** `source` cites; it never carries the message.
7. **The actor is claimed.** Without a signature, `actor` is self-declared, like every other field. Say-Do proves nothing about who wrote a claim; the records are checked either way.

## 4. Checking a claim (normative minimum)

A verifier reports one of four results per claim. **A verifier MAY be stricter than this minimum, never looser.**

| Result | When |
|---|---|
| **`matched`** | A record in `records` exists, **and** its kind is the pointer's `kind` and allowed for the action (§2), **and** it's about the claim's subject: the same id in the same tool, or linked by the verifier's own map between tools. **A name or label never links two subjects** |
| **`matched_by_search`** | `records` is empty, and the verifier found a record that meets the same tests by searching on `subject.id`. **Reported separately; never counted as `matched`** |
| **`no_match`** | No record meets the tests: it isn't there, or it's there and disagrees (wrong subject, wrong kind). A record that disagrees with the claim isn't a match |
| **`cant_check`** | The verifier can't read the tool, or the action is `deleted` and the tool keeps no `deletion` record |

A verifier SHOULD also note, without changing the result:
- **said before the record existed:** the record's own time is after `saidAt`;
- **weak:** the action is `other`.

A verifier reports counts ("2 of 3 matched"), and keeps the actor's words apart from its own count.

## 5. Privacy

- Use **opaque ids**. Never build a person's name into an `id`.
- `label` fields are for display only. A verifier MUST NOT use a label to match.
- `onBehalfOf`, `delegation` and `subject` identify by id; labels are optional.
- `source` never carries message content (rule 6). `paid` points to a payment record, never to card or bank details.

## 6. Where a bot publishes claims

In order of preference:
1. **A note or field on the record it wrote**, in the business's own tool. A verifier with read access to that tool reads it there. The bot writes it; the verifier only reads.
2. **A claims address** (an API) that the business gives the verifier read access to.

A bot's private log, which only its maker can read, doesn't count as published.

## 7. Carrying a claim (bindings, sketches)

- **MCP:** a tool that writes a record returns the claim in `structuredContent`, plus a `resource_link` to the record.
- **A2A:** an artifact extension carrying the claim.
- **OpenTelemetry:** attributes on an `execute_tool` span.

Each binding gets a worked example before v1. Extension URIs and attribute names are not assigned yet.

## 8. What the first tests taught

- **`doneAt` is optional.** In one bot platform tested, tool calls carried no timestamps.
- **Records name what resolved.** Asked to install the latest version of a package, a bot got an older cached one. A claim names the version that resolved.
- **Corrections happen.** Asked for its source, a bot corrected itself twice. Hence `parent.relation: corrects`.
- **One claim per item.** "Sent 3 review requests" needs three claims to show which one missed.

## 9. Related work

Say-Do borrows names where they exist and adds what we didn't find elsewhere: **a pointer to the record the action wrote, kept apart from any verdict.**
- **W3C PROV:** `actedOnBehalfOf`, delegation.
- **IETF drafts:** draft-kuehlewind-audit-architecture (actor, on-behalf-of and a delegation chain, read by an independent auditor); draft-sharif-agent-audit-trail (agent audit records).
- **The protocols bots already speak:** A2A, MCP and OpenTelemetry's GenAI conventions. Say-Do rides on them (§7) rather than replacing them.
- **Signed receipt drafts** (Acta, AER-1, XAIP and others) prove a tool call happened. Say-Do checks whether the business result exists. The two fit together.
