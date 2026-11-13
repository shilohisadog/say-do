// Say-Do v0.2 reference code: validate a claim, check it against records, count the results.
// Pure functions, no dependencies, no clock, no I/O: the caller passes in how to read records. See SPEC.md.

export const VERSION = "0.2";
export const RELATIONS = ["relays", "corrects", "follows"];
export const RECORD_KINDS = ["client", "lead", "request", "visit", "job", "estimate", "invoice", "payment", "refund", "message", "call", "note", "deletion", "other"];
/** SPEC §2: which record kinds can back each action. null = any kind. */
export const BACKED_BY = {
  created: null, updated: null, sent: ["message"], called: ["call"], booked: ["visit", "job"],
  canceled: ["visit", "job", "estimate", "request", "invoice"], assigned: ["job", "visit", "lead", "request"],
  invoiced: ["invoice"], paid: ["payment"], refunded: ["refund"], deleted: ["deletion"], other: null,
};
/** Actions checked by when the record last changed, not when it was made (SPEC §4, test 4). */
export const BY_CHANGE = ["updated", "canceled", "assigned"];
export const ACTIONS = Object.keys(BACKED_BY);
export const RESULTS = ["matched", "matched_by_search", "no_match", "cant_check"];
/** What a reader returns when it can't read the tool at all (as opposed to null: the record isn't there). */
export const UNREADABLE = Symbol("unreadable");

const KINDS = ["bot", "person"];
const SOURCE_KINDS = ["sms", "email", "call", "chat", "task", "schedule"];
const ALLOWED = ["saydo", "id", "parent", "actor", "onBehalfOf", "delegation", "action", "what", "subject", "records", "source", "saidAt", "doneAt", "statement", "ext"];
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isStr = (x) => typeof x === "string" && x.length > 0;
const isUri = (x) => isStr(x) && /^[A-Za-z][A-Za-z0-9+.-]*:.+$/.test(x);
const isTime = (x) => isStr(x) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(x) && !Number.isNaN(Date.parse(x));

/** Problems with a claim, as plain sentences. An empty list means it's valid v0.2. */
export function validate(c) {
  const p = [];
  if (!isObj(c)) return ["A claim is a JSON object."];
  for (const k of Object.keys(c)) {
    if (["verified", "verdict", "success", "succeeded", "outcome", "result"].includes(k)) p.push(`"${k}" isn't allowed: a claim is never a verdict.`);
    else if (!ALLOWED.includes(k)) p.push(`Unknown field "${k}".`);
  }
  if (c.ext !== undefined && !isObj(c.ext)) p.push("ext is an object.");
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
    else if (isTime(c.saidAt) && Date.parse(c.doneAt) > Date.parse(c.saidAt)) p.push("doneAt can't be later than saidAt: claims are about work already done.");
  }
  return p;
}

export const DEFAULTS = { toleranceMinutes: 60, lookbackDays: 7 }; // reference values; guesses to be tuned (SPEC §4)
const MIN = 60000;

/**
 * Checks one claim against the records (SPEC §4, the minimum). Never reads `statement`, `ext` or any label.
 * read(tool, id, account) -> a record, null (not there), or UNREADABLE. A record:
 *   { tool, id, kind, subjectId, createdAt, changedAt?, by? }
 *   subjectId is in the claim's subject namespace: the reader applies the verifier's own map between tools; never a name.
 *   by (optional, when the tool says who made it): { via: "api" | "ui", app?: <actor id the verifier mapped it to> }
 * search(claim) -> records about the claim's subject id (optional; only used when the claim points to none).
 * opts: { checkedAt, toleranceMinutes, lookbackDays }
 * Returns { id, result, why, notes, records, checkedAt, settings }.
 */
export function check(claim, read, search, opts = {}) {
  const settings = { toleranceMinutes: opts.toleranceMinutes ?? DEFAULTS.toleranceMinutes, lookbackDays: opts.lookbackDays ?? DEFAULTS.lookbackDays };
  const out = (result, why, recs = [], extra = []) => ({ id: claim.id, result, why, notes: [...new Set([...extra, ...noteFor(recs)])], records: recs, checkedAt: opts.checkedAt ?? null, settings });
  const allowed = BACKED_BY[claim.action];
  const earliest = claim.doneAt ? Date.parse(claim.doneAt) - settings.toleranceMinutes * MIN
                                : Date.parse(claim.saidAt) - settings.lookbackDays * 1440 * MIN;
  const noteFor = (recs) => [
    ...(recs.some(r => Date.parse(r.changedAt || r.createdAt) > Date.parse(claim.saidAt)) ? ["said before the record existed"] : []),
    ...(recs.some(r => !r.by || (!r.by.app && r.by.via !== "ui")) ? ["author not shown"] : []),
    ...(claim.action === "other" ? ["weak: action is other"] : []),
  ];
  /** The four tests, plus who wrote it. Returns null if the record passes, else why not. */
  const fails = (r, kind) => {
    if (!r) return "isn't there";
    if ((kind && r.kind !== kind) || (allowed && !allowed.includes(r.kind))) return "is the wrong kind of record";
    if (r.subjectId !== claim.subject.id) return "is about someone else";
    const t = Date.parse(BY_CHANGE.includes(claim.action) ? (r.changedAt || r.createdAt) : r.createdAt);
    if (t < earliest) return "is older than the work";
    if (r.by?.app && r.by.app !== claim.actor.id) return "was written by another app";
    if (r.by?.via === "ui" && claim.actor.kind === "bot") return "was made by a person in the tool's own screens";
    return null;
  };

  if (claim.records.length === 0) {
    if (claim.action === "deleted") return out("cant_check", "A deletion with no record pointer can't be checked.");
    const hit = (search ? search(claim) : []).find(r => !fails(r));
    return hit ? out("matched_by_search", "Found by the subject's id; the claim pointed to no record.", [hit])
               : out("no_match", "No record pointer, and no record found for the subject.");
  }
  const found = claim.records.map(p => ({ p, r: read(p.tool, p.id, p.account) }));
  const tools = [...new Set(claim.records.map(p => p.tool))].join(" or ");
  if (found.some(({ r }) => r === UNREADABLE)) return out("cant_check", `Couldn't read ${tools}.`);
  if (claim.action === "deleted" && found.some(({ r }) => !r)) return out("cant_check", `${tools} keeps no record of the deletion.`);
  const bad = found.map(({ p, r }) => fails(r, p.kind)).filter(Boolean);
  const recs = found.map(({ r }) => r).filter(Boolean);
  if (bad.length === 0) return out("matched", "Every record it points to is there and agrees.", recs);
  if (found.length === 1) return out("no_match", bad[0] === "isn't there" ? `No match in ${tools}.` : `The record ${bad[0]}.`, recs);
  return out("no_match", `${found.length - bad.length} of ${found.length} records agree; one ${bad[0]}.`, recs);
}

/** Claim validity against when the verifier first read it (SPEC §3, rule 10). Problems as sentences. */
export function validateSeen(claim, firstSeenAt, opts = {}) {
  const tol = (opts.toleranceMinutes ?? DEFAULTS.toleranceMinutes) * MIN;
  return Date.parse(claim.saidAt) > Date.parse(firstSeenAt) + tol ? ["saidAt is later than when the claim was first read."] : [];
}

/** Notes from when the verifier first read a claim: published late (SPEC §3, rule 10). */
export function seenNotes(claim, firstSeenAt, opts = {}) {
  const lookback = (opts.lookbackDays ?? DEFAULTS.lookbackDays) * 1440 * MIN;
  return Date.parse(firstSeenAt) - Date.parse(claim.saidAt) > lookback ? ["published late"] : [];
}

/** True if a re-read claim differs from the first version read (SPEC §3, rule 8). Key order doesn't matter. */
export function changedAfterPublication(first, again) {
  const canon = (x) => JSON.stringify(x, (k, v) => isObj(v) ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v);
  return first.id === again.id && canon(first) !== canon(again);
}

/** Records pointed to by more than one actor: "tool|account|id" -> [actor ids]. */
export function contested(claims) {
  const by = new Map();
  for (const c of claims) for (const p of c.records) {
    const key = [p.tool, p.account || "", p.id].join("|");
    by.set(key, [...new Set([...(by.get(key) || []), c.actor.id])]);
  }
  return new Map([...by].filter(([, actors]) => actors.length > 1));
}

/**
 * Claims still standing. A correction from the same actor replaces the original only if the original
 * wasn't checked yet (SPEC §3, rule 9); otherwise both count. Everything stays on file.
 */
export function standing(claims, checkedIds = new Set()) {
  const corrected = new Set(claims.filter(c => c.parent?.relation === "corrects" && c.parent.actor === c.actor.id && !checkedIds.has(c.parent.id)).map(c => c.parent.id));
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
    const g = groups.get(key) || { actor: c.actor.name || c.actor.id, action: c.action, what: c.what || null, claimed: 0, matched: 0, matchedBySearch: 0, cantCheck: 0, notChecked: 0, saidAt: c.saidAt, items: [] };
    const r = byId.get(c.id);
    g.claimed++;
    if (r?.result === "matched") g.matched++;
    if (r?.result === "matched_by_search") g.matchedBySearch++;
    if (r?.result === "cant_check") g.cantCheck++;
    if (!r) g.notChecked++;
    if (Date.parse(c.saidAt) > Date.parse(g.saidAt)) g.saidAt = c.saidAt;
    g.items.push({ claim: c.id, subject: c.subject.label || c.subject.id, result: r?.result || "not_checked", records: r?.records || [], notes: r?.notes || [] });
    groups.set(key, g);
  }
  return [...groups.values()];
}
