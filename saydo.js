// Say-Do v0.1 reference code: validate a claim, check it against records, count the results.
// Pure functions, no dependencies, no clock, no I/O: the caller passes in how to read records. See SPEC.md.

export const VERSION = "0.1";
export const RELATIONS = ["relays", "corrects", "follows"];
export const RECORD_KINDS = ["client", "lead", "request", "visit", "job", "estimate", "invoice", "payment", "message", "call", "note", "deletion", "other"];
/** SPEC §2: which record kinds can back each action. null = any kind. */
export const BACKED_BY = {
  created: null, updated: null, sent: ["message"], called: ["call"], booked: ["visit", "job"],
  invoiced: ["invoice"], paid: ["payment"], deleted: ["deletion"], other: null,
};
export const ACTIONS = Object.keys(BACKED_BY);
export const RESULTS = ["matched", "matched_by_search", "no_match", "cant_check"];
/** What a reader returns when it can't read the tool at all (as opposed to null: the record isn't there). */
export const UNREADABLE = Symbol("unreadable");

const KINDS = ["bot", "person"];
const SOURCE_KINDS = ["sms", "email", "call", "chat", "task", "schedule"];
const ALLOWED = ["saydo", "id", "parent", "actor", "onBehalfOf", "delegation", "action", "what", "subject", "records", "source", "saidAt", "doneAt", "statement"];
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isStr = (x) => typeof x === "string" && x.length > 0;
const isUri = (x) => isStr(x) && /^[A-Za-z][A-Za-z0-9+.-]*:.+$/.test(x);
const isTime = (x) => isStr(x) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(x) && !Number.isNaN(Date.parse(x));

/** Problems with a claim, as plain sentences. An empty list means it's valid v0.1. */
export function validate(c) {
  const p = [];
  if (!isObj(c)) return ["A claim is a JSON object."];
  for (const k of Object.keys(c)) {
    if (["verified", "verdict", "success", "succeeded", "outcome", "result"].includes(k)) p.push(`"${k}" isn't allowed: a claim is never a verdict.`);
    else if (!ALLOWED.includes(k)) p.push(`Unknown field "${k}".`);
  }
  if (c.saydo !== VERSION) p.push(`saydo must be "${VERSION}".`);
  if (!isUri(c.id)) p.push("id must be unique everywhere: a UUID URN or another URI.");
  if (c.parent !== undefined && !(isObj(c.parent) && isUri(c.parent.id) && isUri(c.parent.actor) && RELATIONS.includes(c.parent.relation)))
    p.push(`parent needs an id, its actor's id and a relation (${RELATIONS.join(", ")}).`);
  if (!(isObj(c.actor) && KINDS.includes(c.actor.kind) && isUri(c.actor.id))) p.push("actor needs a kind (bot or person) and an id (a URI).");
  if (!(isObj(c.onBehalfOf) && isUri(c.onBehalfOf.id))) p.push("onBehalfOf needs an id (a URI).");
  if (c.delegation !== undefined && !(Array.isArray(c.delegation) && c.delegation.every(d => isObj(d) && KINDS.includes(d.kind) && isUri(d.id))))
    p.push("delegation is a list of { kind, id }.");
  if (!ACTIONS.includes(c.action)) p.push(`action must be one of: ${ACTIONS.join(", ")}.`);
  if (c.action === "other" && !isStr(c.what)) p.push('With action "other", what says what it was.');
  if (!(isObj(c.subject) && isStr(c.subject.id))) p.push("subject needs an id. A label alone never identifies anyone.");
  if (!(Array.isArray(c.records) && c.records.every(r => isObj(r) && isStr(r.tool) && isStr(r.id) && RECORD_KINDS.includes(r.kind))))
    p.push("records is a list of { tool, kind, id }, possibly empty.");
  if (c.source !== undefined) {
    if (!(isObj(c.source) && SOURCE_KINDS.includes(c.source.kind))) p.push(`source needs a kind (${SOURCE_KINDS.join(", ")}).`);
    else if (Object.keys(c.source).some(k => !["kind", "id"].includes(k))) p.push("source cites a message; it never carries its content.");
  }
  if (!isTime(c.saidAt)) p.push("saidAt is a time with an offset or Z.");
  if (c.doneAt !== undefined) {
    if (!isTime(c.doneAt)) p.push("doneAt, when present, is a time with an offset or Z.");
    else if (isTime(c.saidAt) && Date.parse(c.doneAt) > Date.parse(c.saidAt)) p.push("doneAt can't be later than saidAt: v0.1 claims are about work already done.");
  }
  return p;
}

/**
 * Checks one claim against the records (SPEC §4, the minimum). Never reads `statement` or any label.
 * read(tool, id)  -> a record, null (not there), or UNREADABLE.
 *                    A record: { tool, id, kind, subjectId, at, deleted? }. subjectId is in the claim's subject
 *                    namespace: the reader applies the verifier's own map between tools; never a name.
 * search(claim)   -> records about the claim's subject id (optional; used only when the claim points to none).
 * Returns { id, result, record?, why, notes }.
 */
export function check(claim, read, search) {
  const allowed = BACKED_BY[claim.action];
  const agrees = (r, kind) => r && r !== UNREADABLE && (!kind || r.kind === kind) && (!allowed || allowed.includes(r.kind)) && r.subjectId === claim.subject.id;
  const notes = (r) => [
    ...(r && r.at && Date.parse(r.at) > Date.parse(claim.saidAt) ? ["said before the record existed"] : []),
    ...(claim.action === "other" ? ["weak: action is other"] : []),
  ];
  const tools = [...new Set(claim.records.map(p => p.tool))].join(" or ");

  if (claim.records.length > 0) {
    const found = claim.records.map(p => ({ p, r: read(p.tool, p.id) }));
    const hit = found.find(({ p, r }) => agrees(r, p.kind));
    if (hit) return { id: claim.id, result: "matched", record: hit.r, why: "The record it points to is there and agrees.", notes: notes(hit.r) };
    if (claim.action === "deleted") return { id: claim.id, result: "cant_check", why: `${tools} keeps no record of the deletion.`, notes: notes() };
    if (found.every(({ r }) => r === UNREADABLE)) return { id: claim.id, result: "cant_check", why: `Couldn't read ${tools}.`, notes: notes() };
    if (found.some(({ r }) => r && r !== UNREADABLE)) return { id: claim.id, result: "no_match", why: `A record is in ${tools}, but it doesn't agree with the claim.`, notes: notes() };
    return { id: claim.id, result: "no_match", why: `No match in ${tools}.`, notes: notes() };
  }
  if (claim.action === "deleted") return { id: claim.id, result: "cant_check", why: "A deletion with no record pointer can't be checked.", notes: notes() };
  const hit = (search ? search(claim) : []).find(r => agrees(r));
  return hit
    ? { id: claim.id, result: "matched_by_search", record: hit, why: "Found by the subject's id; the claim pointed to no record.", notes: notes(hit) }
    : { id: claim.id, result: "no_match", why: "No record pointer, and no record found for the subject.", notes: notes() };
}

/** Claims still standing: a claim corrected by a later one from the same actor drops out (it stays on file). */
export function standing(claims) {
  const corrected = new Set(claims.filter(c => c.parent?.relation === "corrects" && c.parent.actor === c.actor.id).map(c => c.parent.id));
  return claims.filter(c => !corrected.has(c.id));
}

/** A relayed claim is the original claim: it never adds a second count. */
export function originals(claims) {
  const ids = new Set(claims.map(c => c.id));
  return claims.filter(c => !(c.parent?.relation === "relays" && ids.has(c.parent.id)));
}

/** Counts per actor, action and kind of thing, the way an owner reads them. Counts, never grades.
 *  `matched` counts only "matched"; "matched_by_search" and "cant_check" are counted apart. */
export function summarize(claims, results) {
  const byId = new Map(results.map(r => [r.id, r]));
  const groups = new Map();
  for (const c of claims) {
    const key = [c.actor.id, c.action, c.what || ""].join("|");
    const g = groups.get(key) || { actor: c.actor.name || c.actor.id, action: c.action, what: c.what || null, claimed: 0, matched: 0, matchedBySearch: 0, cantCheck: 0, saidAt: c.saidAt, items: [] };
    const r = byId.get(c.id);
    g.claimed++;
    if (r?.result === "matched") g.matched++;
    if (r?.result === "matched_by_search") g.matchedBySearch++;
    if (r?.result === "cant_check") g.cantCheck++;
    if (Date.parse(c.saidAt) > Date.parse(g.saidAt)) g.saidAt = c.saidAt;
    g.items.push({ claim: c.id, subject: c.subject.label || c.subject.id, result: r?.result || "not_checked", record: r?.record || null, notes: r?.notes || [] });
    groups.set(key, g);
  }
  return [...groups.values()];
}
