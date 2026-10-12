# Existing API inventory

Initial routes were audited at commit `b48b2c5`; the AI foundation routes below have since been added on `feature/ai-sales-data-foundation`. This is an inventory of application route handlers, not a claim that every route has been integration-tested against production.

| Route | Current purpose | Notes relevant to AI Sales Director |
|---|---|---|
| `/api/auth/login` | Authenticate user and issue session cookie | PostgreSQL-backed account validation and rate-limit support. |
| `/api/auth/logout` | Clear session | Existing authentication surface. |
| `/api/admin/access` | Read/update role permissions | Admin-only; admin role itself is protected from permission editing. |
| `/api/admin/employees` | List/create/update/block employees | Admin-only; employee changes create audit entries. |
| `/api/crm/leads` | Create a lead and client | Assigns lead to current sales employee/eligible manager. No corresponding order-from-lead creation route was found. |
| `/api/crm/leads/[id]` | Update lead status or details | Records actual status changes to `LeadStatusHistory` when the migration is present; status updates remain available before migration. Includes loss-reason handling and client updates. |
| `/api/crm/leads/[id]/convert` | Create an order from a qualified lead | Requires both lead/order write permissions, confirmed order total, a qualified status, recorded first qualified transition within 30 days, and no existing linked order. Returns `503` until the migration is present. |
| `/api/orders/[id]` | Update order lifecycle status or edit items, discount, deposit | Enforces record scope and transition order. Deposit remains an editable summary and is not the payment ledger. |
| `/api/orders/[id]/payments` | Record receipt or refund events | Requires order write access; event date and currency are stored, refunds cannot exceed recorded receipts. Returns `503` until the migration is present. |
| `/api/orders/[id]/costs` | Record direct material, labor, or packaging cost | Requires order write access; event date and currency are stored. Returns `503` until the migration is present. |
| `/api/orders/workflow` | Role-limited design/production order transitions | Server validates role and workflow transition. Production UI is not currently wired to a persisted queue. |
| `/api/design/tasks/[id]` | Create/assign/start/approve/revise design tasks | Persists design-task and related order changes, with activity log/notifications. |
| `/api/design/tasks/[id]/files` | Upload versioned JPG/PNG/PDF design files | Authenticated, max 10 MB, validates signatures, stores file bytes on configured/local filesystem. |
| `/api/design/files/[id]` | Retrieve protected design file | Uses authenticated access to design-file storage. |
| `/api/logistics/shipments` | Update shipment state, courier, tracking | Persists shipment and order status; no carrier webhook integration found. |
| `/api/warehouse/inventory` | Record stock incoming/outgoing movement | Prevents outgoing stock below zero and records a movement/audit entry. No production/BOM auto-consumption endpoint found. |
| `/api/marketing/campaigns` | Create/toggle campaign | Stores campaign JSON in `SystemSetting`; current source analytics are not campaign-linked attribution. |
| `/api/notifications` | Retrieve/mark notifications | Existing internal notification mechanism. |

## Routes/pages not found

- No `/api/ai/**` endpoints, analytics summary/forecast/manager KPI API, or AI audit endpoint.
- No OpenAI integration or AI chat endpoint.
- Payment/refund event APIs now exist in the feature branch; they have not yet been deployed or reconciled with a payment provider.
- No order collection route (`/api/orders`) or handler found that creates an order from a lead.
- No Kommo, WhatsApp messaging, or Telegram webhook/client route found.

## Current reports and dashboards

- `/dashboard` exists, but its displayed revenue/conversion figures are hardcoded (and it has demo fallback values); it is not a trustworthy financial analytics API.
- `/crm` calculates lead pipeline/source summaries from current lead records.
- `/orders` provides order filters and order detail links.
- `/audit` provides activity-log review to authorized users.
- There is no dedicated report page/API for owner goals, manager KPI, forecast, AI recommendations, or AI decision history.
