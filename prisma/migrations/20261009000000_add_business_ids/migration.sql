-- CreateTable
CREATE TABLE "business_sequences" (
    "name" TEXT NOT NULL,
    "current_val" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_sequences_pkey" PRIMARY KEY ("name")
);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "customer_code" TEXT;

-- Backfill existing customers with deterministic CUS-000001, CUS-000002, etc.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as rn
  FROM "customers"
  WHERE "customer_code" IS NULL
)
UPDATE "customers" c
SET "customer_code" = 'CUS-' || LPAD(numbered.rn::text, 6, '0')
FROM numbered
WHERE c.id = numbered.id;

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");
CREATE INDEX "customers_customer_code_idx" ON "customers"("customer_code");

-- Initialize Business Sequences
INSERT INTO "business_sequences" ("name", "current_val", "updated_at")
VALUES
  ('CUSTOMER', (SELECT COALESCE(COUNT(*), 0) FROM "customers"), CURRENT_TIMESTAMP),
  ('ORDER', (SELECT COALESCE(COUNT(*), 0) FROM "orders"), CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
