# AI Sales Director integration plan

This plan is based on the repository audit at commit `b48b2c5`, with the data foundation now under implementation on `feature/ai-sales-data-foundation`. It preserves the existing CRM, avoids production writes by AI, and is gated on owner review of business definitions.

## Guardrails

- Financial values and forecasts are calculated by deterministic application code; an LLM may explain verified results, not calculate or invent them.
- Initial AI access is read-only and uses narrowly scoped server-side tools.
- Never expose secrets, session tokens, or unnecessary client PII to an external model.
- CRM comments and client messages are untrusted input, not instructions.
- AI cannot change goals, employee plans, pay, discounts, payment records, orders, or send client messages.
- Any later task creation remains a draft until a responsible human approves it.
- Existing CRM behavior must continue to work if the AI provider is unavailable or disabled.
- Use feature flags, provider timeouts, request/cost limits, privacy-safe logs, and an explicit off switch.

## Ordered implementation gates

### Gate 0 — Approve definitions and test environment

Review this audit and decide payment/revenue semantics, qualified lead definition, conversion cohorts, attribution, currency/timezone/calendar, margin inputs, and owner/admin separation. Confirm a disposable test database and tested backup/restore path. Do not alter production.

### Gate 1 — Make source data trustworthy

Design and review domain changes for payment events and refunds, cost inputs, reliable lead-to-order conversion, and persisted production work. Ensure order/lead attribution and event timestamps are explicit. Add migrations only after reviewing the data migration and rollback/restore plan.

The feature branch adds lead status history, qualified-lead conversion with a user-confirmed total, manager attribution snapshots, receipt/refund and direct-cost event APIs, and KZT margin eligibility checks. The migration has not been applied. The current `deposit` field remains a summary and must not substitute for payment history. Inventory stock `unitPrice` and the current static BOM are not sufficient by themselves to calculate order margin.

### Gate 2 — Deterministic analytics API

Implement read-only, server-side summary, manager/self KPI, forecast, pipeline, overdue/risk, and order-status queries using the confirmed source of truth. Apply role/record scope in each API handler, not only by hiding UI. Return calculation period, `asOf` timestamp, formula/version, and data limitations.

Proposed initial calculation definitions, subject to owner approval:

- Plan attainment = confirmed net collected revenue for the period / approved target.
- Conversion = paid orders attributed to a qualified lead cohort / qualified leads in the same cohort.
- Average paid order = confirmed net collected revenue / count of paid orders.
- Forecast = confirmed fact plus average revenue per elapsed working day times remaining working days; show the period, timezone, and method.

Refund treatment, partial payments, zero denominators, duplicates, reassignment, and cohort windows must be specified and tested before publishing these metrics.

### Gate 3 — Owner/manager dashboard without AI

Add goals with author/version/approval history and read-only KPI/forecast/pipeline/risk views. Use explicit owner-versus-admin permissions. Managers see team scope; sales users see self-only approved metrics. Avoid returning unauthorized financial columns from server APIs.

### Gate 4 — Read-only AI chat and recommendations

After verified numbers are available, add the model provider behind a server-only service and feature flag. Expose only bounded, typed, read-only tools such as company goals, scoped sales summary, manager performance, overdue leads, pipeline analysis, and order statuses. Include source references and data freshness with every answer. Do not pass raw CRM messages unless separately approved and minimized.

### Gate 5 — Human-approved tasks, reports, and integrations

Start recommendations as drafts, then require ROP approval, track execution, and verify outcomes against CRM events and metrics. Reuse an existing general task module only if repository verification shows one suitable; the current schema has design tasks but no general AI-action task workflow.

Treat scheduled reports, Telegram, Kommo, WhatsApp, and message-quality coaching as separate integration projects. Require explicit account linking, provider secrets, consent/legal review, minimal payloads, rate limits, audit, and failure handling before enabling them.

### Gate 6 — Read-only pilot, then production approval

Run first on test data and then in a read-only pilot. Measure KPI reconciliation against the approved accounting source, forecast error, recommendation usefulness, role isolation, provider cost, and outage behavior. Production requires reviewed migrations, tested restore/rollback, monitoring, feature flags, owner approval, and user guidance.

## Acceptance checks before AI pilot

- KPI totals reconcile with the approved accounting/payment source for a defined period.
- Tests cover partial payments, refunds, cancellations, duplicates, reassignment, timezone boundaries, zero denominators, and cohort selection.
- Sales users cannot access another manager's financial records through either UI or direct API calls.
- The model cannot mutate source records or call unapproved tools.
- Prompt injection in lead notes/comments cannot override server policy or reveal out-of-scope data.
- Provider outage/timeout leaves the CRM operational and clearly reports AI unavailability.
- Audit trail records human approvals and subsequent task outcomes without storing unnecessary sensitive prompts.
