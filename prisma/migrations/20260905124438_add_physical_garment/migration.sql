-- AlterTable
ALTER TABLE "order_photos" ADD COLUMN     "physical_garment_id" TEXT;

-- CreateTable
CREATE TABLE "physical_garments" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "unitNumber" INTEGER NOT NULL,
    "is_ready" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_garments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "physical_garments_order_item_id_idx" ON "physical_garments"("order_item_id");

-- CreateIndex
CREATE INDEX "order_photos_physical_garment_id_idx" ON "order_photos"("physical_garment_id");

-- AddForeignKey
ALTER TABLE "physical_garments" ADD CONSTRAINT "physical_garments_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_physical_garment_id_fkey" FOREIGN KEY ("physical_garment_id") REFERENCES "physical_garments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
