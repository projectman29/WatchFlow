# WatchFlow architecture audit

Audit date: 2026-10-12
Audited commit: `b48b2c5` (`master`, synchronized with `origin/master`)

This is a read-only repository audit for the proposed AI Sales Director. No application code, database, or runtime configuration was changed for this audit.

## Executive summary

The AI Sales Director is feasible as an extension of the existing application. The project already has a suitable base: Next.js App Router, PostgreSQL through Prisma, authenticated server pages and API routes, role permissions, leads, orders, design task/file records, inventory movements, shipments, notifications, and activity logging.

It is not yet safe to produce reliable financial KPIs or recommendations from the current data. The application has no payment/refund ledger or cost-of-goods model, the dashboard contains hardcoded revenue/conversion figures, sales plans and KPI rules are only schema models, and the design/production pages display hardcoded example tasks. The CRM also has no application route found that creates an order from a won lead.

Recommended next implementation gate: agree on business definitions and close the data gaps, then deliver deterministic read-only analytics. Add an LLM only after owners verify those numbers.

## Architecture observed

- Application: Next.js App Router, React, and TypeScript (`package.json`, `app/`).
- Persistence: PostgreSQL configured in `prisma/schema.prisma`; application data access uses Prisma.
- Server surface: pages under `app/**/page.tsx`; route handlers under `app/api/**/route.ts`.
- Validation: API inputs commonly use Zod.
- Authentication: bcrypt password verification and a signed `watchflow_session` cookie in `lib/auth.ts`.
- Authorization: `lib/access.ts` defines role permissions and section access; server pages and API handlers perform permission checks.
- Record scope: sales users are scoped to their own employee ID; managers to themselves and direct reports through `getRecordScope` in `lib/db-data.ts`.
- Audit and workflow support: `ActivityLog` and `Notification` are persisted in PostgreSQL; many multi-record changes use Prisma transactions.
- Deployment-sensitive files: design uploads default to local `var/design-files/`; `README.md` warns production needs persistent protected storage.

## Roles and access fit

The current role set is `admin`, `manager`, `sales`, `designer`, `master`, `warehouse`, `logistics`, and `marketing` (`lib/access.ts`, `lib/admin.ts`).

- There is no separate `owner` role. `admin` has broad access, including operations, employees, audit, and all listed business sections.
- `manager` and `sales` have record scoping in the shared CRM/order data helpers, but both roles include order-write permission. Order editing includes changing the stored deposit amount.
- There are no AI-specific permissions such as chat use, goal approval, team/self KPI visibility, task management, or AI audit access.
- Admin role permissions are intentionally protected from editing in the access-management UI/API.

The target role model in `x2.txt` therefore requires an explicit decision: introduce an owner/business-analytics permission boundary, or map owner functions to a carefully limited existing role. Do not assume that `admin` should automatically receive owner-only financial analytics.

## Business workflow fit

The project has order lifecycle labels from `NEW` through design, production, shipment, delivery, completion, and cancellation in `lib/orders.ts`. CRM leads and orders are separate records. Lead creation is implemented in `app/api/crm/leads/route.ts`; no order-creation handler from a won lead was found under `app/` or `lib/`.

Design task actions and protected design-file upload logic exist in `app/api/design/tasks/[id]/route.ts` and `app/api/design/tasks/[id]/files/route.ts`. However, `app/design/page.tsx` displays a fixed in-memory list rather than tasks loaded from PostgreSQL.

The order workflow endpoint exists at `app/api/orders/workflow/route.ts`, but `app/production/page.tsx` displays fixed in-memory examples and does not present a database-backed production queue.

Warehouse adjustments persist stock changes and movement history (`app/api/warehouse/inventory/route.ts`). The displayed BOM is a code constant in `lib/inventory.ts`; no persisted product-to-component consumption relation or automatic production material deduction was found.

Logistics reads persisted orders/shipments and supports shipment status, courier, and tracking updates (`app/logistics/page.tsx`, `app/api/logistics/shipments/route.ts`). A returned shipment is represented in logistics, but no payment refund record exists, and `RETURNED` is not part of `ORDER_STATUS_FLOW`.

## Analytics readiness

Not ready for owner/manager KPI reporting without changes:

1. The dashboard calculates revenue as `orderCount * 2400` and uses fixed conversion values (`app/dashboard/page.tsx`). These are not verified financial facts.
2. `Order.deposit` and `paymentStatus` represent a current summary value, not a list of payment events with dates, methods, references, and reversals (`prisma/schema.prisma`; `app/api/orders/[id]/route.ts`).
3. No payment or refund model/route, `paidAt` field, cost-of-goods model, labor cost, or gross-margin calculation was found.
4. `SalesPlan` and `KpiRule` exist in the Prisma schema, but no application usage was found under `app/` or `lib/`.
5. The CRM has lead statuses and estimated lead values, but the business definition of a “qualified lead” and the attribution rule for a converted order are not encoded.
6. Dashboard and shared data helpers can return demo/fallback values. Those paths must not be used as real analytics inputs.

## External integration status

No OpenAI SDK/API integration, Kommo client/webhook, Telegram bot, or WhatsApp messaging integration was found in the application, libraries, Prisma schema, or dependency manifest. WhatsApp is currently a client contact field, not an integration.

## Audit conclusion

Proceed in stages. First agree on source-of-truth definitions and complete the order/payment/cost data model; then implement server-side deterministic, read-only analytics with role scoping and test coverage. Only after the business verifies those outputs should an LLM be allowed to explain them.

See [database-map.md](./database-map.md), [existing-api.md](./existing-api.md), and [ai-integration-plan.md](./ai-integration-plan.md).
