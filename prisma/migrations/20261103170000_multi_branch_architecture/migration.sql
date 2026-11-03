-- AlterTable: stores
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "email" TEXT;

-- CreateIndex: stores_code_key
CREATE UNIQUE INDEX IF NOT EXISTS "stores_code_key" ON "stores"("code");

-- In-place update of existing stores to Charholi and Alephata
UPDATE "stores"
SET "name" = 'Charholi Branch',
    "code" = 'CHARHOLI',
    "address" = 'Shop 4, Lane 7, Charholi, Pune 412105',
    "phone" = '+91 20 2615 0000',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'store-kp-001';

UPDATE "stores"
SET "name" = 'Alephata Branch',
    "code" = 'ALEPHATA',
    "address" = 'Shop 10, Pune-Nashik Highway, Alephata 412411',
    "phone" = '+91 20 2615 9999',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'store-kp-002';

-- AlterTable: customers - add store_id column
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "store_id" TEXT;

-- Assign all existing customers to Charholi branch (store-kp-001)
UPDATE "customers"
SET "store_id" = 'store-kp-001'
WHERE "store_id" IS NULL;

-- Enforce NOT NULL on store_id
ALTER TABLE "customers" ALTER COLUMN "store_id" SET NOT NULL;

-- AddForeignKey: customers -> stores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_store_id_fkey'
  ) THEN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Drop global unique constraint on customer phone
DROP INDEX IF EXISTS "customers_phone_key";
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_phone_key";

-- Create compound unique index on (store_id, phone)
CREATE UNIQUE INDEX IF NOT EXISTS "customers_store_id_phone_key" ON "customers"("store_id", "phone");

-- Create index on customers(store_id)
CREATE INDEX IF NOT EXISTS "customers_store_id_idx" ON "customers"("store_id");
