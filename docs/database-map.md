# WatchFlow database map

Audited against `prisma/schema.prisma` at commit `b48b2c5`.

## Existing entities

| Area | Models | Current use and constraints |
|---|---|---|
| Identity and access | `User`, `Role`, `Permission`, `Employee` | Users have a role and optional employee profile. Employees have an optional manager and direct reports. Role-permission relations are the current authorization source. |
| CRM | `Client`, `Lead` | A lead may reference a client and an employee manager. Leads store status, source, estimated value, loss reason, and notes. Client stores contact fields including phone, WhatsApp, Instagram, city, source, status, and notes. |
| Orders | `Order`, `OrderItem` | An order may reference a client, originating lead, and manager. It stores status, total, discount, deposit, and a summary payment status. Items store product name, quantity, unit price, and watch customizations. |
| Design | `DesignTask`, `DesignFile` | One design task per order; assigned designer, deadline, notes, revisions, status, and file metadata/version. File bytes are stored on the application filesystem, not in PostgreSQL. |
| Inventory | `InventoryItem`, `InventoryMovement` | SKU, on-hand stock, reorder level, unit price, and manual movement records. No persisted bill-of-materials relation joins product variants to component quantities. |
| Logistics | `Shipment` | Order-linked shipment status, courier, tracking number, shipped/delivered timestamps. |
| Plans / KPI rules | `SalesPlan`, `KpiRule` | Plan target/actual and bonus fields, plus threshold rules. These models have no application usage found in `app/` or `lib/`. |
| Audit / notifications | `ActivityLog`, `Notification` | Activity records store actor/user, action, entity, optional details and time. Notifications are per-user and have read timestamps. |
| Settings | `SystemSetting` | General key/value settings; marketing campaigns are stored as JSON values in this model. |

## Data map for proposed AI metrics

| Metric or context | Current source | Readiness |
|---|---|---|
| Lead counts and statuses | `Lead.status`, `Lead.createdAt`, `Lead.managerId` | Available, subject to agreed stage and cohort definitions. |
| Lead source performance | `Lead.source`, `Lead.status`, `Lead.value` | Basic counts and won-value aggregates are possible; `value` is a lead estimate, not confirmed collected revenue. |
| Order volume and lifecycle | `Order.status`, `createdAt`, `managerId` | Available for counts and cycle/status analysis. |
| Order booked total | `Order.total`, `discount`, `OrderItem` | Available as the current order record, not a payment ledger. |
| Collected revenue | `Order.deposit`, `paymentStatus` | Not reliable as an event-based financial source: no payment rows, payment dates, or reversals/refunds. Deposit can be overwritten while editing an order. |
| Refunds / returns | `Shipment.status` may be `RETURNED` | Logistics return state exists, but no refund amount/event or financial reversal is recorded. |
| Average paid check | Order totals/deposits | Not safely calculable as “paid” until payment semantics, timestamps, and refunds are modeled. |
| Gross margin | No complete source | Not available. Inventory item `unitPrice` is not connected to consumed components or labor per order. |
| Manager target attainment | `SalesPlan.targetAmount`, `actualAmount` | Schema exists, application does not use it; actualAmount is not derived from confirmed payment events. |
| Conversion | Lead and order models can be related | Not complete: no confirmed lead-to-order creation flow found, no paid timestamp, and “qualified lead” is undefined. |
| Production workload / lateness | Design task has deadline/status; order has status | Design-task data exists, but production task/workload/deadline model is not present. Production page currently uses examples. |
| Inventory risk | Inventory stock and reorder level | Basic low-stock signal is possible; consumption forecast and order-specific component availability are not modeled. |
| Delivery performance | Shipment timestamps/status | Basic persisted shipment lifecycle exists; carrier event sync/integration was not found. |
| Marketing attribution | `Lead.source`; campaigns in `SystemSetting` | Source grouping is possible. Campaign-to-lead attribution relation and spend-to-revenue attribution are not modeled. |

## Information needed before schema design

Business owners should decide:

1. Which event counts as revenue: payment captured, deposit, delivery, or another accounting event.
2. How partial payments, failed payments, refunds, chargebacks, and cancelled orders affect KPI totals.
3. The exact qualified-lead statuses, conversion cohort, and conversion window.
4. Whether sales attribution follows the lead owner, order owner, or owner at payment time, including reassignment.
5. Currency and timezone rules and the business calendar for forecast working days.
6. Which costs are included in margin: components, labor, packaging, shipping, fees, and advertising.
7. Whether an owner role is separate from operational admin and which financial fields each role may see.

No migration should be designed until these definitions and a backup/restore procedure for the test database are approved.
