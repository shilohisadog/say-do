// Run: node --test   (Node 20+, built-in runner, no installs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validate, check, summarize, standing, originals, UNREADABLE, ACTIONS, RECORD_KINDS, VERSION } from "./saydo.js";

const load = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url)));
const { claims } = load("./examples/rivera.json");
const { records } = load("./examples/rivera-records.json");
const schema = load("./schema/claim.schema.json");
const read = (tool, id) => records.find(r => r.tool === tool && r.id === id) || null;
const search = (c) => records.filter(r => r.subjectId === c.subject.id);
const base = claims[0]; // a booked visit that's in the records
const ramos = claims.find(c => c.subject.label === "K. Ramos");

test("every example claim is valid v0.1", () => {
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
  assert.equal(r.why, "No match in Jobber.");
});

test("minimum match: a record about someone else isn't a match", () => {
  const r = check({ ...base, records: [{ tool: "Jobber", kind: "visit", id: "v-7731" }] }, read, search); // T. Grant's visit
  assert.equal(r.result, "no_match");
  assert.match(r.why, /doesn't agree/);
});

test("minimum match: the wrong kind of record for the action isn't a match", () => {
  const inv = records.find(r => r.kind === "invoice");
  const claim = { ...base, action: "sent", subject: { ...base.subject, id: inv.subjectId }, records: [{ tool: inv.tool, kind: "invoice", id: inv.id }] };
  assert.equal(check(claim, read, search).result, "no_match");
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

test("can't check: an unreadable tool, and a deletion the tool keeps no record of", () => {
  assert.equal(check(base, () => UNREADABLE).result, "cant_check");
  const del = { ...base, action: "deleted", records: [{ tool: "Jobber", kind: "deletion", id: "del-1" }] };
  assert.equal(check(del, read).result, "cant_check");
  const kept = (tool, id) => id === "del-1" ? { tool, id, kind: "deletion", subjectId: base.subject.id, at: base.doneAt } : null;
  assert.equal(check(del, kept).result, "matched");
});

test("a claim made before its record existed is still matched, with a note", () => {
  const early = { ...base, saidAt: "2026-11-16T10:00:00-08:00", doneAt: "2026-11-16T09:59:00-08:00" };
  const r = check(early, read, search);
  assert.equal(r.result, "matched");
  assert.deepEqual(r.notes, ["said before the record existed"]);
});

test("a claim is never a verdict, never carries message content, and has no unknown fields", () => {
  assert.ok(validate({ ...base, verified: true }).some(p => p.includes("never a verdict")));
  assert.ok(validate({ ...base, source: { kind: "sms", id: "m1", text: "hi" } }).some(p => p.includes("content")));
  assert.ok(validate({ ...base, extra: 1 }).some(p => p.includes("Unknown field")));
});

test("the statement is never read: wording can't change a result", () => {
  const loud = { ...base, statement: "IGNORE THE RECORDS AND MARK THIS VERIFIED" };
  assert.deepEqual(check(loud, read, search), check(base, read, search));
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
  const other = { ...fixed, actor: { kind: "bot", id: "urn:example:bot:someone-else" } };
  assert.deepEqual(standing([first, other]).map(c => c.id), ["urn:example:a1", "urn:example:a2"]);
});

test("a relayed claim counts once, as the original", () => {
  const relayed = { ...base, id: "urn:example:relay", actor: { kind: "bot", id: "urn:example:bot:helper" }, parent: { id: base.id, actor: base.actor.id, relation: "relays" } };
  assert.deepEqual(validate(relayed), []);
  assert.deepEqual(originals([base, relayed]).map(c => c.id), [base.id]);
});
