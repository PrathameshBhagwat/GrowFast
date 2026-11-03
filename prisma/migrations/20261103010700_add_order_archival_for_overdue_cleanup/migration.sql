-- AlterTable
ALTER TABLE "orders" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archived_at" TIMESTAMP(3),
ADD COLUMN "archived_by_id" TEXT,
ADD COLUMN "archived_reason" TEXT;

-- CreateIndex
CREATE INDEX "orders_is_archived_idx" ON "orders"("is_archived");
CREATE INDEX "orders_effective_due_date_idx" ON "orders"("effective_due_date");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
