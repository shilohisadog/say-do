// Run: node --test   (Node 20+, built-in runner, no installs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validate, check, summarize, standing, originals, contested, validateSeen, seenNotes, changedAfterPublication, UNREADABLE, ACTIONS, RECORD_KINDS, VERSION } from "./saydo.js";

const load = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url)));
const { claims } = load("./examples/rivera.json");
const { records } = load("./examples/rivera-records.json");
const schema = load("./schema/claim.schema.json");
const read = (tool, id) => records.find(r => r.tool === tool && r.id === id) || null;
const { vectors, settings } = load("./examples/vectors.json");
const search = (c) => records.filter(r => r.subjectId === c.subject.id);
const base = claims[0]; // a booked visit that's in the records
const ramos = claims.find(c => c.subject.label === "K. Ramos");

test("every example claim is valid for this version", () => {
  for (const c of claims) assert.deepEqual(validate(c), [], c.id);
});

test("the schema and the reference validator agree on versions, actions, kinds and required fields", () => {
  assert.equal(schema.properties.saydo.const, VERSION);
  assert.deepEqual(schema.properties.action.enum, ACTIONS);
  assert.deepEqual(schema.properties.records.items.properties.kind.enum, RECORD_KINDS);
  for (const k of schema.required) {
    const { [k]: _, ...missing } = base;
    assert.ok(validate(missing).length > 0, `missing ${k} should fail`);
  }
});

test("one day's claims: 2 of 2 bookings, 4 of 4 invoices, 2 of 3 review requests", () => {
  const groups = summarize(claims, claims.map(c => check(c, read, search)));
  assert.deepEqual(groups.map(g => [g.actor, g.action, g.matched, g.claimed]), [
    ["AI receptionist", "booked", 2, 2], ["Office bot", "invoiced", 4, 4], ["Office bot", "sent", 2, 3]]);
  const r = check(ramos, read, search);
  assert.equal(r.result, "no_match");
  assert.equal(r.why, "No match in getjobber.com.");
});

test("no pointer: found by search is reported apart, never counted as matched", () => {
  const noPtr = { ...base, records: [] };
  const r = check(noPtr, read, search);
  assert.equal(r.result, "matched_by_search");
  const [g] = summarize([noPtr], [r]);
  assert.equal(g.matched, 0);
  assert.equal(g.matchedBySearch, 1);
});

test("a label alone is invalid and never matches", () => {
  assert.ok(validate({ ...base, subject: { label: "M. Silva" } }).some(p => p.includes("label alone")));
});

test("a claim is never a verdict, never carries message content, and has no unknown fields", () => {
  assert.ok(validate({ ...base, verified: true }).some(p => p.includes("never a verdict")));
  assert.ok(validate({ ...base, source: { kind: "sms", id: "m1", text: "hi" } }).some(p => p.includes("content")));
  assert.ok(validate({ ...base, extra: 1 }).some(p => p.includes("Unknown field")));
});

test("times: doneAt optional, never after saidAt; both need an offset or Z", () => {
  const { doneAt, ...noDone } = base;
  assert.deepEqual(validate(noDone), []);
  assert.ok(validate({ ...base, doneAt: "2026-11-16T20:00:00-08:00" }).some(p => p.includes("later than saidAt")));
  assert.ok(validate({ ...base, saidAt: "2026-11-16T19:30:00" }).length > 0);
  assert.deepEqual(validate({ ...base, saidAt: "2026-11-17T03:30:00Z", doneAt: "2026-11-17T03:00:00Z" }), []);
});

test("ids are unique everywhere: a URI, not a bare name", () => {
  assert.ok(validate({ ...base, id: "claim-1" }).length > 0);
  assert.ok(validate({ ...base, actor: { kind: "bot", name: "Some bot" } }).length > 0); // no actor id
});

test("a correction from the same actor replaces the earlier claim; both stay on file", () => {
  const first = { ...base, id: "urn:example:a1" };
  const fixed = { ...base, id: "urn:example:a2", parent: { id: "urn:example:a1", actor: base.actor.id, relation: "corrects" } };
  assert.deepEqual(standing([first, fixed]).map(c => c.id), ["urn:example:a2"]);
  // After the original was checked, a correction can't erase it: both count.
  assert.deepEqual(standing([first, fixed], new Set(["urn:example:a1"])).map(c => c.id), ["urn:example:a1", "urn:example:a2"]);
  const other = { ...fixed, actor: { kind: "bot", id: "urn:example:bot:someone-else" } };
  assert.deepEqual(standing([first, other]).map(c => c.id), ["urn:example:a1", "urn:example:a2"]);
});

test("a relayed claim counts once, as the original", () => {
  const relayed = { ...base, id: "urn:example:relay", actor: { kind: "bot", id: "urn:example:bot:helper" }, parent: { id: base.id, actor: base.actor.id, relation: "relays" } };
  assert.deepEqual(validate(relayed), []);
  assert.deepEqual(originals([base, relayed]).map(c => c.id), [base.id]);
});

test("conformance vectors (examples/vectors.json)", async (t) => {
  for (const v of vectors) await t.test(v.name, () => {
    const rd = (tool, id) => { const r = v.records.find(x => x.tool === tool && x.id === id); return !r ? null : r.unreadable ? UNREADABLE : r; };
    const srch = v.search ? (c) => v.records.filter(r => r.subjectId === c.subject.id) : undefined;
    const r = check(v.claim, rd, srch, settings);
    assert.equal(r.result, v.expect.result, r.why);
    if (v.expect.notes) assert.deepEqual(r.notes, v.expect.notes);
  });
});

test("every result states the verifier's settings and when it read", () => {
  const r = check(base, read, search, { checkedAt: "2026-11-17T06:34:00-08:00" });
  assert.equal(r.checkedAt, "2026-11-17T06:34:00-08:00");
  assert.deepEqual(r.settings, { toleranceMinutes: 60, lookbackDays: 7 });
});

test("backdating: saidAt after first read is invalid; read long after saidAt is noted", () => {
  assert.ok(validateSeen({ ...base, saidAt: "2026-11-18T00:00:00-08:00" }, "2026-11-17T06:00:00-08:00").length > 0);
  assert.deepEqual(validateSeen(base, "2026-11-17T06:00:00-08:00"), []);
  assert.deepEqual(seenNotes(base, "2026-12-01T06:00:00-08:00"), ["published late"]);
  assert.deepEqual(seenNotes(base, "2026-11-17T06:00:00-08:00"), []);
});

test("a published claim never changes: a re-read with new content is caught; key order isn't a change", () => {
  const reordered = Object.fromEntries(Object.entries(base).reverse());
  assert.equal(changedAfterPublication(base, reordered), false);
  assert.equal(changedAfterPublication(base, { ...base, records: [] }), true);
});

test("two actors pointing at one record are flagged", () => {
  const rival = { ...base, id: "urn:example:rival", actor: { kind: "bot", id: "urn:example:bot:rival" } };
  assert.deepEqual([...contested([base, rival]).values()], [[base.actor.id, "urn:example:bot:rival"]]);
  assert.equal(contested(claims).size, 0);
});

test("extensions are allowed and never change a result", () => {
  const withExt = { ...base, ext: { "com.example.priority": "high" } };
  assert.deepEqual(validate(withExt), []);
  assert.equal(check(withExt, read, search).result, check(base, read, search).result);
});
