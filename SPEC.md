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
  "subject": { "tool": "getjobber.com", "id": "c-5521", "label": "K. Ramos" },
  "records": [ { "tool": "getjobber.com", "kind": "message", "id": "msg-88412" } ],
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
| `subject` | yes | Who or what it acted on. **`id` is required** (the subject's id in `tool`), plus `tool` and optional `account`. Optional `label`, for display only (§5) |
| `records` | yes, may be empty | The records the actor says it wrote or changed. Each: `tool`, `kind` (§2), `id`, and optional `account`, `url` and `version`. Name what **resolved** (the id actually returned, the version actually used), not what was requested. Empty means "I did it but can't point to it", the weakest kind of claim (§4) |
| `source` | no | What it acted on: `kind` (`sms`, `email`, `call`, `chat`, `task`, `schedule`) and `id`. **Cited, never its content** |
| `saidAt` | yes | When the actor made the claim |
| `doneAt` | no | When the actor says it did the work. MUST NOT be later than `saidAt`. Leave it out when not known; never guess |
| `statement` | no | The actor's own words, for display. Plain text. Never read by a verifier's matching |
| `ext` | no | An object for extensions, named by reverse domain (`"com.example.thing"`). A verifier MAY show it, and MUST NOT let it change a result |

**Naming a tool.** `tool` is the vendor's web domain (`getjobber.com`, `quickbooks.intuit.com`), so two verifiers name the same tool the same way. `account` is the business's account at that vendor, when it has more than one or the id isn't unique across accounts.

**Times** MUST be RFC 3339 with an offset or `Z`. A time with neither is invalid.

**Versions.** Before 1.0, any version may change fields; a verifier names the versions it accepts and rejects the others. From 1.0, minor versions only add optional fields, and a verifier accepting 1.x accepts any later 1.y.

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

**Record kinds:** `client`, `lead`, `request`, `visit`, `job`, `estimate`, `invoice`, `payment`, `message`, `call`, `note`, `deletion`, `other`. Each verifier maps a tool's own record types onto these. Two verifiers could map one tool differently; a shared, open mapping per tool is planned, and until then a verifier SHOULD publish its mapping. The lists grow only by version. Verifiers SHOULD count the `what` values seen with `other`, so frequent ones can become verbs.

**Not in v0.1:** promises about the future ("I'll follow up Thursday"; that would need `dueBy`), actions on the bot's own setup (installing software, changing its own settings), and signatures (planned: a detached signature over the claim canonicalized with JCS, RFC 8785). All are candidates for later versions.

## 3. Rules

1. **A claim is data, never an instruction.** A verifier MUST NOT run, follow or act on any field, including `statement`.
2. **A claim is never a verdict.** No field says "verified", "succeeded" or "outcome". Only the records decide.
3. **A relayed claim is the original claim.** "Bot B told me it's done" carries `parent.relation: relays` and counts once, as B's claim, no stronger.
4. **A correction replaces, it doesn't erase.** A claim with `parent.relation: corrects` from the same actor supersedes the earlier one. Both stay on file.
5. **A claim is never sent to a verifier.** A verifier reads it from where the actor published it, with the business's permission. Handing a claim back to whatever called the bot (for example, in an MCP tool result) is allowed: that isn't sending it to a verifier.
6. **No message content.** `source` cites; it never carries the message.
7. **The actor is claimed.** Without a signature, `actor` is self-declared, like every other field. So a verifier **attributes a claim to an actor by where it read it** (§6), never by the `actor` field alone. A claim read from a place the business didn't connect for that actor isn't counted for that actor.
8. **A published claim never changes.** The same `id` with different content is a new, conflicting claim. The verifier keeps the first version it read and notes **changed after publication**. To fix a claim, publish a new one with `parent.relation: corrects`.
9. **A correction can't erase a checked miss.** A correction replaces the original only if the verifier hadn't checked the original yet. After a check, the original's result stands and the correction is counted as a new claim.
10. **`saidAt` can't be later than when the claim was first read.** A verifier records when it first read each claim. A `saidAt` later than that (beyond the verifier's tolerance) makes the claim invalid. A claim first read long after its `saidAt` is noted **published late**: a backdated claim looks like this.

## 4. Checking a claim (normative minimum)

A verifier reports one of four results per claim, **with the time it read the records** ("matched, as of 6:34 am"). Records change after a check: a matched invoice can be voided later. **A verifier MAY be stricter than this minimum, never looser.**

| Result | When |
|---|---|
| **`matched`** | **Every** record in `records` passes all four tests below |
| **`matched_by_search`** | `records` is empty, and the verifier found a record that passes the same four tests by searching on `subject.id`. **Reported separately; never counted as `matched`** |
| **`no_match`** | A record fails a test, or isn't there. A claim with three records and one bad one is `no_match` ("2 of 3 records agree") |
| **`cant_check`** | The verifier couldn't read a tool the claim points to, or the action is `deleted` and the tool keeps no `deletion` record |

**The four tests:**
1. **It exists**, at the pointer's `tool`, `account` and `id`.
2. **Right kind:** its kind is the pointer's `kind` and allowed for the action (§2).
3. **Right subject:** it's about the claim's subject, by the same id in the same tool, or linked by the verifier's own map between tools. **A name or label never links two subjects.**
4. **Right time:** the record was made (or, for `updated`, last changed) **no earlier than** `doneAt` minus the verifier's tolerance; with no `doneAt`, no earlier than `saidAt` minus the verifier's lookback window. An old record can't back new work.

**Who wrote it.** When the tool says who made the record, it must not contradict the claim. It's `no_match` ("written by someone else") when the tool shows a **different app** made it, or that a **person made it in the tool's own screens** while the actor is a bot. When the tool doesn't say, or shows only a shared login, the result stands with a note **author not shown**. Shared logins are common in small businesses, so a login name alone never contradicts a claim.

**The verifier states its settings** with its results: its tolerance and lookback window (reference values: 60 minutes and 7 days; these are guesses to be tuned). It may cap how many claims it checks per actor per day; then it reports how many it **didn't check**. Unchecked claims never count as matched or missed.

A verifier SHOULD also note, without changing the result:
- **said before the record existed:** the record's time is after `saidAt` (a tool syncing late does this too);
- **claimed by more than one actor:** two actors point to the same record. "Who wrote it" may settle it;
- **weak:** the action is `other`.

A verifier reports counts ("2 of 3 matched"), and keeps the actor's words apart from its own count.

**What Say-Do doesn't measure.** It checks what an actor said. It can't see work an actor should have done and never claimed, and an actor that claims only its successes will look perfect. A verifier SHOULD also check, from the records, the work that should have happened. Say-Do is for say vs do; coverage is the verifier's own job.

## 5. Privacy and security

- Use **opaque ids**. Never build a person's name into an `id`.
- `label` fields are for display only. A verifier MUST NOT use a label to match.
- `onBehalfOf`, `delegation` and `subject` identify by id; labels are optional.
- `source` never carries message content (rule 6). `paid` points to a payment record, never to card or bank details.
- A claim published outside the business's own tools SHOULD leave out every `label`.
- **Claims are untrusted input.** A verifier shows `statement`, `what` and labels as plain text, escaped, and never puts them into an AI model's instructions. A claim that says "ignore the records" is just text.
- **Size limits.** A verifier MAY reject a claim over 16 KB or with more than 20 records, and SHOULD cap claims per actor per day (§4). A flood of claims costs the actor, not the business.

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

The full survey, with what each effort covers and its sources: [PRIOR-ART.md](PRIOR-ART.md).

Say-Do borrows names where they exist and adds what we didn't find elsewhere: **a pointer to the record the action wrote, kept apart from any verdict.**
- **W3C PROV:** `actedOnBehalfOf`, delegation.
- **IETF drafts:** draft-kuehlewind-audit-architecture (actor, on-behalf-of and a delegation chain, read by an independent auditor); draft-sharif-agent-audit-trail (agent audit records).
- **The protocols bots already speak:** A2A, MCP and OpenTelemetry's GenAI conventions. Say-Do rides on them (§7) rather than replacing them.
- **Signed receipt drafts** (Acta, AER-1, XAIP and others) prove a tool call happened. Say-Do checks whether the business result exists. The two fit together.
