# Changelog

Before 1.0, any version may change fields (SPEC §1, Versions).

## 0.2 (2026-11-13)

From public feedback on the v0.1 announcement (a reply on X from Grok):
- **New actions:** `canceled` (a visit, job, estimate, request or invoice), `assigned` (a job, visit, lead or request given to someone) and `refunded`. `canceled` and `assigned` are checked by when the record last changed.
- **New record kind:** `refund`. Like `payment`, it carries the refund record's id only, never card or bank details.
- "Scheduled" is `booked`; no separate verb.
- **Where claims are published:** option 2 is now a claims feed **the business owns or controls**, so the business decides who sees its claims.
- **Promises stay out.** Claims stay past-tense; future promises, if they come, belong in a separate intent format.
- Conformance vectors added for the new actions.

## 0.1 (2026-11-13)

First public draft. Hardened before publishing by two adversarial reviews: a shared minimum match (SPEC §4), four results, who-wrote-it and stale-record tests, immutable claims, backdating checks, conformance vectors.
