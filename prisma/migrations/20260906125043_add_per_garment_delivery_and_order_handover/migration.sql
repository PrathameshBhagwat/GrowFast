-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "delivered_by_id" TEXT;

-- AlterTable
ALTER TABLE "physical_garments" ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "is_delivered" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "orders_delivered_by_id_idx" ON "orders"("delivered_by_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivered_by_id_fkey" FOREIGN KEY ("delivered_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
