ALTER TABLE "Order"
ADD COLUMN "currency" TEXT,
ADD COLUMN "attributedSalesEmployeeId" TEXT,
ADD COLUMN "attributedSalesName" TEXT,
ADD COLUMN "attributedSalesEmail" TEXT;

CREATE TABLE "LeadStatusHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderDirectCost" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderDirectCost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Order_currency_createdAt_idx" ON "Order"("currency", "createdAt");
CREATE INDEX "Order_attributedSalesEmployeeId_createdAt_idx" ON "Order"("attributedSalesEmployeeId", "createdAt");
CREATE INDEX "LeadStatusHistory_leadId_changedAt_idx" ON "LeadStatusHistory"("leadId", "changedAt");
CREATE INDEX "LeadStatusHistory_toStatus_changedAt_idx" ON "LeadStatusHistory"("toStatus", "changedAt");
CREATE INDEX "OrderPayment_orderId_occurredAt_idx" ON "OrderPayment"("orderId", "occurredAt");
CREATE INDEX "OrderPayment_kind_occurredAt_idx" ON "OrderPayment"("kind", "occurredAt");
CREATE INDEX "OrderDirectCost_orderId_incurredAt_idx" ON "OrderDirectCost"("orderId", "incurredAt");
CREATE INDEX "OrderDirectCost_category_incurredAt_idx" ON "OrderDirectCost"("category", "incurredAt");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_attributedSalesEmployeeId_fkey"
FOREIGN KEY ("attributedSalesEmployeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadStatusHistory"
ADD CONSTRAINT "LeadStatusHistory_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadStatusHistory"
ADD CONSTRAINT "LeadStatusHistory_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderPayment"
ADD CONSTRAINT "OrderPayment_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderPayment"
ADD CONSTRAINT "OrderPayment_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderDirectCost"
ADD CONSTRAINT "OrderDirectCost_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderDirectCost"
ADD CONSTRAINT "OrderDirectCost_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
