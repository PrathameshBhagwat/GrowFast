-- AlterTable
ALTER TABLE "physical_garments" ADD COLUMN     "is_cancelled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "physical_garments_order_item_id_unitNumber_key" ON "physical_garments"("order_item_id", "unitNumber");
